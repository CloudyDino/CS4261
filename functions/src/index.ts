import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { google } from 'googleapis';
import googleCredentials from './credentials.json';

import { PayrollInfo } from "./objects";

admin.initializeApp();
const db = admin.firestore();

// Start writing Firebase Functions
// https://firebase.google.com/docs/functions/typescript

const OAuth2 = google.auth.OAuth2;
const oAuth2Client = new OAuth2(
  googleCredentials.web.client_id,
  googleCredentials.web.client_secret,
  googleCredentials.web.redirect_uris[0]
);

oAuth2Client.setCredentials({
  refresh_token: googleCredentials.refresh_token
});

const calendar = google.calendar({
  version: 'v3',
  auth: oAuth2Client
});

async function getCalendarId(calendarName: string): Promise<string> {
  const calList = await calendar.calendarList.list();
  const calendars = calList.data.items;

  if (calendars?.length) {
    for (let i = 0; i < calendars?.length; i++) {
      if (calendars[i].summary == calendarName && typeof calendars[i].id === 'string') {
        return calendars[i].id!!;
      }
    }
  }

  return 'primary';
}

async function getEmployeeHours(startDate: Date, endDate: Date): Promise<Map<string, number>> {
  const hoursPerEmployee = new Map();

  const calendarId = await getCalendarId('Work Schedule')
  const calendarEvents = await calendar.events.list({
    calendarId: calendarId,
    timeMin: startDate.toDateString(),
    timeMax: endDate.toDateString(),
    singleEvents: true
  });
  const employeeEvents = calendarEvents.data.items;

  if (employeeEvents?.length) {
    for (let i = 0; i < employeeEvents.length; i++) {
      const name = employeeEvents[i].summary;
      const endString = employeeEvents[i].end?.dateTime;
      const startString = employeeEvents[i].start?.dateTime;
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

export const getPayrollInfo = functions.https.onCall(async (data: any, context: CallableContext) => {
  // Authentication / user information is automatically added to the request.
  const uid = context.auth!!.uid;

  // Data passed in by client
  const startDate = data.startDate;
  const endDate = data.endDate;

  const hoursPerEmployee = false ? await getEmployeeHours(startDate, endDate) : new Map<string, number>();

  const payrollInfo = new PayrollInfo();

  const querySnapshot = await db.collection('test').doc(uid).collection('employees').get();
  if (querySnapshot.size != 0) {
    querySnapshot.forEach(employeeDocRef => {
      const employee = employeeDocRef.data();

      const totalHours = hoursPerEmployee.get(employee.name) || 0;
      const regularHours = Math.min(totalHours, 40);
      const grossRegularPay = employee.hourlyWage * regularHours;
      const overtimeHours = Math.max(0, totalHours - regularHours);
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

      payrollInfo.employeeInfo.push({
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
      });
      payrollInfo.totalSalaryToPay += netPay;
      payrollInfo.totalTaxesToPay += totalEmployeeTaxes + totalCompanyTaxes;
    });
  }

  payrollInfo.totalMoneyRequired = payrollInfo.totalSalaryToPay + payrollInfo.totalTaxesToPay;

  return payrollInfo;
});