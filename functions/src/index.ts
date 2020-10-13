import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { google, calendar_v3, Auth } from 'googleapis';
import googleCredentials from './credentials.json';

import { EmployeeInfo, PayrollInfo } from "./objects";

admin.initializeApp();
const db = admin.firestore();

const oAuth2Client = new google.auth.OAuth2(
  googleCredentials.web.client_id,
  googleCredentials.web.client_secret,
  googleCredentials.web.redirect_uris[0]
);

const url = oAuth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/calendar.readonly'
  ]
});

async function getCalendarApi(credentials: Auth.Credentials) {
  // TODO: Check if we need to make a local copy in case multiple threads are
  // editing a single instance of oAuth2Client
  oAuth2Client.setCredentials(credentials);
  return google.calendar({
    version: 'v3',
    auth: oAuth2Client
  });
}

async function getCalendarId(calendarApi: calendar_v3.Calendar, calendarName: string): Promise<string> {
  const calList = await calendarApi.calendarList.list();
  const calendars = calList.data.items;

  if (calendars) {
    for (const calendar of calendars) {
      if (calendar.summary === calendarName && typeof calendar.id === 'string') {
        return calendar.id;
      }
    }
  }

  return 'primary';
}

async function getEmployeeHours(calendarApi: calendar_v3.Calendar, startDate: string, endDate: string): Promise<Map<string, number>> {
  const hoursPerEmployee = new Map();

  const calendarId = await getCalendarId(calendarApi, 'Work Schedule');
  const calendarEvents = await calendarApi.events.list({
    calendarId: calendarId,
    timeMin: startDate,
    timeMax: endDate,
    singleEvents: true
  });
  const employeeEvents = calendarEvents.data.items;

  if (employeeEvents) {
    for (const employeeEvent of employeeEvents) {
      const name = employeeEvent.summary;
      const endString = employeeEvent.end?.dateTime;
      const startString = employeeEvent.start?.dateTime;
      if (endString && startString) {
        const end = new Date(endString);
        const start = new Date(startString);
        const seconds = (end.getTime() - start.getTime()) / 1000;
        const hours = seconds / (60 * 60);

        if (hoursPerEmployee.has(name)) {
          hoursPerEmployee.set(name, hoursPerEmployee.get(name) + hours);
        } else {
          hoursPerEmployee.set(name, hours);
        }
      }
    }
  }
  return hoursPerEmployee;
}

function getEmployeePayrollInfo(employee: any, hours: number): EmployeeInfo {
  const regularHours = Math.min(hours, 40);
  const grossRegularPay = employee.hourlyWage * regularHours;
  const overtimeHours = Math.max(0, hours - regularHours);
  const grossOvertimePay = 1.5 * employee.hourlyWage * overtimeHours;
  const grossPay = grossRegularPay + grossOvertimePay;

  const federalUnemployment = Math.min(7000, 0.006 * grossPay);
  const federalWitholding = 0;  // TODO
  const medicareCompany = 0.0145 * grossPay;
  const medicareEmployee = 0.0145 * grossPay;
  const medicareEmployeeAddlTax = 0.009 * grossPay;
  const socialSecurtityCompany = Math.min(137700, 0.062 * grossPay);
  const socialSecurtityEmployee = Math.min(137700, 0.062 * grossPay);;
  const stateWitholding = 0;  // TODO
  const stateUnemployment = Math.min(9500, 0.0264 * grossPay);
  const stateAdminAssesment = Math.min(9500, 0.009 * grossPay);

  const totalEmployeeTaxes = federalWitholding
    + medicareEmployee
    + medicareEmployeeAddlTax
    + socialSecurtityEmployee
    + stateWitholding;
  const totalCompanyTaxes = federalUnemployment
    + medicareCompany
    + socialSecurtityCompany
    + stateUnemployment
    + stateAdminAssesment;

  const netPay = grossPay - totalEmployeeTaxes;

  return {
    name: employee.name,
    regularHours: regularHours,
    regularHourlyWage: employee.hourlyWage,
    grossRegularPay: grossRegularPay,
    overtimeHours: overtimeHours,
    overtimeHourlyWage: 1.5 * employee.hourlyWage,
    grossOvertimePay: grossOvertimePay,
    grossPay: grossPay,
    federalUnemployment: federalUnemployment,
    federalWitholding: federalWitholding,
    medicareCompany: medicareCompany,
    medicareEmployee: medicareEmployee,
    medicareEmployeeAddlTax: medicareEmployeeAddlTax,
    socialSecurtityCompany: socialSecurtityCompany,
    socialSecurtityEmployee: socialSecurtityEmployee,
    stateWitholding: stateWitholding,
    stateUnemployment: stateUnemployment,
    stateAdminAssesment: stateAdminAssesment,
    totalEmployeeTaxes: totalEmployeeTaxes,
    totalCompanyTaxes: totalCompanyTaxes,
    netPay: netPay
  };
}

export const updateGoogleApiAuthCredentials = functions.https.onCall(async (data: any, context: CallableContext) => {
  const uid = context.auth?.uid;
  const authorizationCode = data.authorizationCode;
  if (typeof uid === 'undefined' || typeof authorizationCode !== 'string') {
    return Promise.reject();
  }
  try {
    const { tokens } = await oAuth2Client.getToken(authorizationCode);
    await db.collection('test').doc(uid).update({
      googleApiAuthCredentials: tokens
    });
  } catch (error) {
    console.log(error);
    return Promise.reject();
  }
  return;
});

export const getPayrollInfo = functions.https.onCall(async (data: any, context: CallableContext) => {
  // Authentication / user information is automatically added to the request.
  const uid = context.auth?.uid;
  if (typeof uid === 'undefined') {
    return Promise.reject();
  }

  // Data passed in by client
  const startDate = data.startDate;
  const endDate = data.endDate;

  try {

    const userSnapshot = await db.collection('test').doc(uid).get();
    const googleApiAuthCredentials = userSnapshot.data()?.googleApiAuthCredentials;

    if (!googleApiAuthCredentials) {
      return {
        authUrl: url
      };
    }

    let hoursPerEmployee: Map<string, number>;
    try {
      const calendarApi = await getCalendarApi(googleApiAuthCredentials);
      hoursPerEmployee = await getEmployeeHours(calendarApi, startDate, endDate);
    } catch (error) {
      // User probably revoked permisions
      console.log(error);
      return {
        authUrl: url
      };
    }

    const payrollInfo = new PayrollInfo();

    const employeeCollectionSnapshot = await db.collection('test').doc(uid).collection('employees').get();
    if (employeeCollectionSnapshot.size !== 0) {
      employeeCollectionSnapshot.forEach(employeeDocRef => {
        const employeeDocData = employeeDocRef.data()
        const employeeInfo = getEmployeePayrollInfo(employeeDocData, hoursPerEmployee.get(employeeDocData.name) || 0);
        payrollInfo.employeeInfo.push(employeeInfo);
        payrollInfo.totalSalaryToPay += employeeInfo.netPay;
        payrollInfo.totalTaxesToPay += employeeInfo.totalEmployeeTaxes + employeeInfo.totalCompanyTaxes;
      });
    }

    payrollInfo.totalMoneyRequired = payrollInfo.totalSalaryToPay + payrollInfo.totalTaxesToPay;
    return payrollInfo;

  } catch (error) {
    console.error(error);
    return Promise.reject();
  }
});
