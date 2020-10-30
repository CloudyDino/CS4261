import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { CallableContext } from 'firebase-functions/lib/providers/https';
import { google, calendar_v3, Auth } from 'googleapis';
import googleCredentials from './credentials.json';

import { EmployeeInfo, PayrollInfo, W4Data, StateTaxData } from "./objects";

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

async function getCalendarApi(credentials: Auth.Credentials, uid: string) {
  oAuth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
      db.collection('test').doc(uid).set(
        { googleApiAuthCredentials: tokens },
        { merge: true }
      );
    }
  });

  oAuth2Client.setCredentials(credentials);
  return google.calendar({
    version: 'v3',
    auth: oAuth2Client
  });
}

// Returns a map of calendar ids to calendar names
async function getAllCalendars(calendarApi: calendar_v3.Calendar) {
  const calList = await calendarApi.calendarList.list();
  const calendars = calList.data.items;
  const calendarIdToName: string[][] = [];

  if (calendars) {
    for (const calendar of calendars) {
      if (typeof calendar.summary === 'string' && typeof calendar.id === 'string') {
        calendarIdToName.push([calendar.id, calendar.summary]);
      }
    }
  }

  return calendarIdToName
}

export const getCalendars = functions.https.onCall(async (data: any, context: CallableContext) => {
  const uid = context.auth?.uid;
  if (typeof uid === 'undefined') {
    return Promise.reject();
  }

  try {

    const userSnapshot = await db.collection('test').doc(uid).get();
    const googleApiAuthCredentials = userSnapshot.data()?.googleApiAuthCredentials;

    if (!googleApiAuthCredentials) {
      return {
        authUrl: url
      };
    }

    return {
      default: userSnapshot.data()?.defaultCalendarId ?? "",
      calendars: Object.entries(await getAllCalendars(await getCalendarApi(googleApiAuthCredentials, uid)))
    };
  } catch (error) {
    console.log(error);
    return {
      authUrl: url
    };;
  }
});

async function getEmployeeHours(calendarApi: calendar_v3.Calendar, calendarId: string, startDate: string, endDate: string): Promise<Map<string, number>> {
  const hoursPerEmployee = new Map();

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

const PercentageMethodTable_OneJob_MarriedFilingJointly_2020: number[][] = [
  [0, 11900, 0.00, 0.00, 0],
  [11900, 31650, 0.00, 0.10, 11900],
  [32650, 92150, 1975.00, 0.12, 31650],
  [92150, 182950, 9235.00, 0.22, 92150],
  [182950, 338500, 29211.00, 0.24, 182950],
  [338500, 426600, 66543.00, 0.32, 338500],
  [426600, 633950, 94735.00, 0.35, 426600],
  [633950, Number.POSITIVE_INFINITY, 167307.50, 0.37, 633950]
];

const PercentageMethodTable_TwoJobs_MarriedFilingJointly_2020: number[][] = [
  [0, 12400, 0.00, 0.00, 0],
  [12400, 22275, 0.00, 0.10, 12400],
  [22275, 52525, 987.50, 0.12, 22275],
  [52525, 97925, 4617.50, 0.22, 52525],
  [97925, 175700, 14605.50, 0.24, 97925],
  [175700, 219750, 33271.50, 0.32, 175700],
  [219750, 323425, 47367.50, 0.35, 219750],
  [323425, Number.POSITIVE_INFINITY, 83653.75, 0.37, 323425]
];
const PercentageMethodTable_OneJob_SingleOrMarriedFilingSeparately_2020: number[][] = [
  [0, 3800, 0.00, 0.00, 0],
  [3800, 13675, 0.00, 0.10, 3800],
  [13675, 43925, 987.50, 0.12, 13675],
  [43925, 89325, 4617.50, 0.22, 43925],
  [89325, 167100, 14605.50, 0.24, 89325],
  [167100, 211150, 33271.50, 0.32, 167100],
  [211150, 522200, 47367.50, 0.35, 211150],
  [522200, Number.POSITIVE_INFINITY, 156235.00, 0.37, 522200]
];
const PercentageMethodTable_TwoJobs_SingleOrMarriedFilingSeparately_2020: number[][] = [
  [0, 6200, 0.00, 0.00, 0],
  [6200, 11138, 0.00, 0.10, 6200],
  [11138, 26263, 493.75, 0.12, 11138],
  [26263, 48963, 2308.75, 0.22, 26263],
  [48963, 87850, 7302.75, 0.24, 48963],
  [87850, 109875, 16635.75, 0.32, 87850],
  [109875, 265400, 23683.75, 0.35, 109875],
  [265400, Number.POSITIVE_INFINITY, 78117.50, 0.37, 265400]
];
const PercentageMethodTable_OneJob_HeadOfHousehold_2020: number[][] = [
  [0, 10050, 0.00, 0.00, 0],
  [10050, 24150, 0.00, 0.10, 10050],
  [24150, 63750, 1410.00, 0.12, 24150],
  [63750, 95550, 6162.00, 0.22, 63750],
  [95550, 173350, 13158.00, 0.24, 95550],
  [173350, 217400, 31830.00, 0.32, 173350],
  [217400, 528450, 45926.00, 0.35, 217400],
  [528450, Number.POSITIVE_INFINITY, 154793.50, 0.37, 528450]
];
const PercentageMethodTable_TwoJobs_HeadOfHousehold_2020: number[][] = [
  [0, 9325, 0.00, 0.00, 0],
  [9325, 16375, 0.00, 0.10, 9325],
  [16375, 36175, 705.00, 0.12, 16375],
  [36175, 52075, 3081.00, 0.22, 36175],
  [52075, 90975, 6579.00, 0.24, 52075],
  [90975, 113000, 15915.00, 0.32, 90975],
  [113000, 268525, 22963.00, 0.35, 113000],
  [269525, Number.POSITIVE_INFINITY, 77396.75, 0.37, 268525]
];

// Uses https://www.irs.gov/publications/p15t
function calculateFederalWitholding(grossPay: number, days: number, w4Data: W4Data): number {
  const payPeriods = 365.25 / days;
  let adjustedAnnualWageAmount = grossPay * payPeriods;
  adjustedAnnualWageAmount += w4Data.step4a;
  adjustedAnnualWageAmount -= w4Data.step4b;
  if (!w4Data.twoJobs) {
    if (w4Data.filingStatus === 'marriedFilingJointly') {
      adjustedAnnualWageAmount -= 12900;
    } else {
      adjustedAnnualWageAmount -= 8600;
    }
  }
  adjustedAnnualWageAmount = Math.max(0, adjustedAnnualWageAmount);

  let table: number[][];
  if (w4Data.filingStatus === 'marriedFilingJointly') {
    if (w4Data.twoJobs) {
      table = PercentageMethodTable_TwoJobs_MarriedFilingJointly_2020;
    } else {
      table = PercentageMethodTable_OneJob_MarriedFilingJointly_2020;
    }
  } else if (w4Data.filingStatus === 'headOfHousehold') {
    if (w4Data.twoJobs) {
      table = PercentageMethodTable_TwoJobs_HeadOfHousehold_2020;
    } else {
      table = PercentageMethodTable_OneJob_HeadOfHousehold_2020;
    }
  } else {  // 'single' or 'marriedFilingSeparately'
    if (w4Data.twoJobs) {
      table = PercentageMethodTable_TwoJobs_SingleOrMarriedFilingSeparately_2020;
    } else {
      table = PercentageMethodTable_OneJob_SingleOrMarriedFilingSeparately_2020;
    }
  }
  let row: number;
  for (row = 0; row < table.length - 1; row++) {
    if (adjustedAnnualWageAmount < table[row][1]) {
      break;
    }
  }
  let tentativeWithholdingAmount = adjustedAnnualWageAmount - table[row][0];
  tentativeWithholdingAmount *= table[row][3];
  tentativeWithholdingAmount += table[row][2];
  tentativeWithholdingAmount /= payPeriods;

  return Math.max(0, tentativeWithholdingAmount - w4Data.step3) + w4Data.step4c;
}

const standardDeduction = new Map<string, number>([
  ['single', 4600],
  ['marriedFilingSeparately', 3000],
  ['marriedFilingJointly-bothSpousesWorking', 6000],
  ['marriedFilingJointly-oneSpouseWorking', 6000],
  ['headOfHousehold', 4600]
]);



const georgiaIncomeTaxBrackets = new Map<string, number[][]>([
  ['single', [
    [0, 750, 0.01, 0.00],
    [750, 2250, 0.02, 7.50],
    [2250, 3750, 0.03, 37.50],
    [3750, 5250, 0.04, 82.50],
    [5350, 7000, 0.05, 142.50],
    [7000, Number.POSITIVE_INFINITY, 0.0575, 230]
  ]],
  ['marriedFilingSeparately', [
    [0, 500, 0.01, 0.00],
    [500, 1500, 0.02, 5.00],
    [1500, 2500, 0.03, 25.00],
    [2500, 3500, 0.04, 55.00],
    [3500, 5000, 0.05, 95.00],
    [5000, Number.POSITIVE_INFINITY, 0.0575, 170]
  ]],
  ['marriedFilingJointly-bothSpousesWorking', [
    [0, 500, 0.01, 0.00],
    [500, 1500, 0.02, 5.00],
    [1500, 2500, 0.03, 25.00],
    [2500, 3500, 0.04, 55.00],
    [3500, 5000, 0.05, 95.00],
    [5000, Number.POSITIVE_INFINITY, 0.0575, 170]
  ]],
  ['marriedFilingJointly-oneSpouseWorking', [
    [0, 1000, 0.01, 0.00],
    [1000, 3000, 0.02, 10.00],
    [3000, 5000, 0.03, 50.00],
    [5000, 7000, 0.04, 110.00],
    [7000, 10000, 0.05, 190.00],
    [10000, Number.POSITIVE_INFINITY, 0.0575, 340]
  ]],
  ['headOfHousehold', [
    [0, 1000, 0.01, 0.00],
    [1000, 3000, 0.02, 10.00],
    [3000, 5000, 0.03, 50.00],
    [5000, 7000, 0.04, 110.00],
    [7000, 10000, 0.05, 190.00],
    [10000, Number.POSITIVE_INFINITY, 0.0575, 340]
  ]]
]);
function calculateGeorgiaStateWitholding(grossPay: number, days: number, stateTaxExempt: boolean, stateTaxData: StateTaxData): number {
  if (stateTaxExempt) {
    return 0;
  }

  let taxableIncome = grossPay * 365.25 / days;
  taxableIncome -= (standardDeduction.get(stateTaxData.filingStatus) ?? 0);
  taxableIncome -= 3000 * stateTaxData.dependentAllowance;

  let stateIncomeTax = 0;
  for (const bracket of georgiaIncomeTaxBrackets.get(stateTaxData.filingStatus) ?? []) {
    if (bracket[0] <= taxableIncome && taxableIncome < bracket[1]) {
      stateIncomeTax = bracket[2] * (taxableIncome - bracket[0]) + bracket[3];
      break;
    }
  }
  stateIncomeTax = stateIncomeTax * days / 365.25;

  return stateIncomeTax + stateTaxData.additionalWitholding;
}

function getEmployeePayrollInfo(employee: any, hours: number, days: number): EmployeeInfo {
  const regularHours = Math.min(hours, 40);
  const grossRegularPay = employee.hourlyWage * regularHours;
  const overtimeHours = Math.max(0, hours - regularHours);
  const grossOvertimePay = 1.5 * employee.hourlyWage * overtimeHours;
  const grossPay = grossRegularPay + grossOvertimePay;

  const federalUnemployment = Math.min(7000, 0.006 * grossPay);
  const federalWitholding = calculateFederalWitholding(grossPay, days, employee.w4Data);
  const medicareCompany = 0.0145 * grossPay;
  const medicareEmployee = 0.0145 * grossPay;
  const medicareEmployeeAddlTax = 0.009 * Math.max(0, grossPay - 200000);
  const socialSecurtityCompany = 0.062 * Math.min(137700, grossPay);
  const socialSecurtityEmployee = 0.062 * Math.min(137700, grossPay);
  const stateWitholding = calculateGeorgiaStateWitholding(grossPay, days, employee.stateTaxExempt, employee.stateTaxInfo);
  const stateUnemployment = 0.0264 * Math.min(9500, grossPay);
  const stateAdminAssesment = 0.009 * Math.min(9500, grossPay);

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
    await db.collection('test').doc(uid).set(
      { googleApiAuthCredentials: tokens },
      { merge: true }
    );
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
  const calendarId = data.calendarId;
  const startDate = data.startDate;
  const endDate = data.endDate;
  const days = (new Date(endDate)).getDate() - (new Date(startDate)).getDate();

  try {

    db.collection('test').doc(uid).set(
      { defaultCalendarId: calendarId },
      { merge: true }
    ).catch(error => {
      console.log(error);
    });
    const userSnapshot = await db.collection('test').doc(uid).get();
    const googleApiAuthCredentials = userSnapshot.data()?.googleApiAuthCredentials;

    if (!googleApiAuthCredentials) {
      return {
        authUrl: url
      };
    }

    let hoursPerEmployee: Map<string, number>;
    try {
      const calendarApi = await getCalendarApi(googleApiAuthCredentials, uid);
      hoursPerEmployee = await getEmployeeHours(calendarApi, calendarId, startDate, endDate);
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
        const employeeInfo = getEmployeePayrollInfo(employeeDocData, hoursPerEmployee.get(employeeDocData.name) || 0, days);
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
