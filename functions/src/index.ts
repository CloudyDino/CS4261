import * as functions from 'firebase-functions';
import {google} from 'googleapis';
import googleCredentials from './credentials.json';

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

const ERROR_RESPONSE = {
    status: "500",
    message: "There was an error retrieving information from your Google calendars"
};

export const helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

async function getCalendars() {
  const calMap = new Map(); //key: calendar name, value: calendar id
  const calList = await calendar.calendarList.list();
  const calendars = calList.data.items;
  
  if (calendars?.length) {
    for (let i = 0; i < calendars?.length; i++) {
      let title = calendars[i].summary;
      let id = calendars[i].id;
      calMap.set(title, id);
    }
  }

  /*
  Not very familiar with TypeScript so doing it in this weird way.

  If I used calMap as a regular {}, title would not be allowed as a key because 
  it could be null or undefined so I used a Map to get around that.

  However, the Map type doesn't show up in the response so had to convert it back
  to array of key-value pairs.
  */
  const map: any = {};
  calMap.forEach((val: string, key: string) => {
    map[key] = val;
  })
  console.log(map);
  return map; 
}

/*
returns list of all calendars associated with account in the form of a map with
key = calendar name and value = calendar id. 

We could display the calendar names in a dropdown list in Payroll screen, when user
selects the calendar they want, we use the corresponding id to grab all the events
on the calendar (employee names)
*/
export const getCalendarList = functions.https.onRequest((request, response) => {
  getCalendars().then(data => {
    response.status(200).send(data);
    return;
  }).catch(err => {
    console.error('Error retrieving list of calendars from account: ' + err.message); 
    response.status(500).send(ERROR_RESPONSE); 
    return;
  });
});

/*
DO NOT USE

-gets all events belonging to the calendar specified by the id
-for every event, calculate duration and add to the hours of the event's name key in map if it exists
-returns map (key = name of event, value = total hours of event(s*)) 
    *including recurring events, which employee scheduling events most likely would be
*/
async function calculateEmployeeHours(calendarId: string) {
  const employees = new Map(); //key: employee name, value: total scheduled hours

  //get all events from a specific calendar
  const calendarEvents = await calendar.events.list({
    calendarId: calendarId,
    timeMin: "2020-10-01T00:00:00Z", //TODO: someway for user to select time period
    timeMax: "2020-10-31T00:00:00Z", 
    singleEvents: true
  });
  const employeeEvents = calendarEvents.data.items;
  console.log("got items");
  
  if (employeeEvents?.length) {
    for (let i = 0; i < employeeEvents.length; i++) {
      let name = employeeEvents[i].summary;

      let check = null;
      let endString = employeeEvents[i].end?.dateTime;
      let startString = employeeEvents[i].start?.dateTime;
      if (endString == check || startString == check) { 
        //checks if endString or startString is undefined or null, can't cast to Date obj otherwise
        employees.set(name, -1); 
        //-1 indicates the times of event was retrieved in unusable format such as being null or undefined
      } else {
        let end = new Date(endString).getHours();
        let start = new Date(startString).getHours();
        let hours = end - start; 
        console.log(name + ": " + hours);

        if (employees.has(name)) {
          let totalHours = employees.get(name) + hours;
          employees.set(name, totalHours);
        } else {
          employees.set(name, hours);
        }
      }
    }
  }
  
  const map: any = {};
  employees.forEach((val: number, key: string) => {
    map[key] = val;
  })

  console.log(map);
  return map; 
}

/*
DO NOT USE THIS FUNCTION

Can't figure out way to pass in calendarId from Work Schedule:
  - Using getCalendars() to use the map results in error when I try to read the data
    from the Promise. 
  - Pasting the code from getCalendars directly into here to get the id would require making this an async function and
    I'm not sure if we want to do that. 
  - Making calMap a const variable outside the getCalendars function so that we can still access the values
    after running getCalendars() doesn't work. calMaps is empty in this function while filled out in getCalendars()

Would like to have the calendarId of the user selected scheduling calendar passed in 
*/
export const getEmployeeHours = functions.https.onRequest((request, response) => {
  //TODO pass in user selected calendar's id 
  let calendarId = ""; 
  //let calendarId = 'urgn9stkpplvjatha9mg6fere4@group.calendar.google.com';
  calculateEmployeeHours(calendarId).then(data => {
    response.status(200).send(data);
    return;
  }).catch(err => {
    console.error('Error retrieving list of calendars from account: ' + err.message); 
    response.status(500).send(ERROR_RESPONSE); 
    return;
  });
});

/*
combines getCalendars() and calculateEmployeeHours()
*/
async function finalCalculateEmployeeHours() {
  const calMap = new Map(); //key: calendar name, value: calendar id
  const calList = await calendar.calendarList.list();
  const calendars = calList.data.items;
  
  if (calendars?.length) {
    for (let i = 0; i < calendars?.length; i++) {
      let title = calendars[i].summary;
      let id = calendars[i].id;
      calMap.set(title, id);
    }
  }

  const employees = new Map(); //key: employee name, value: total scheduled hours

  //get all events from a specific calendar
  const calendarEvents = await calendar.events.list({
    calendarId: calMap.get('Work Schedule'),
    timeMin: "2020-10-01T00:00:00Z", //TODO: some way for user to select time period
    timeMax: "2020-10-31T00:00:00Z", 
    singleEvents: true
  });
  const employeeEvents = calendarEvents.data.items;
  
  if (employeeEvents?.length) {
    for (let i = 0; i < employeeEvents.length; i++) {
      let name = employeeEvents[i].summary;

      let check = null;
      let endString = employeeEvents[i].end?.dateTime;
      let startString = employeeEvents[i].start?.dateTime;
      if (endString == check || startString == check) { 
        //checks if endString or startString is undefined or null, can't cast to Date obj otherwise
        employees.set(name, -1); 
        //-1 indicates the times of event was retrieved in unusable format such as being null or undefined
      } else {
        let end = new Date(endString).getHours();
        let start = new Date(startString).getHours();
        let hours = end - start; 

        if (employees.has(name)) {
          let totalHours = employees.get(name) + hours;
          employees.set(name, totalHours);
        } else {
          employees.set(name, hours);
        }
      }
    }
  }
  
  const map: any = {};
  employees.forEach((val: number, key: string) => {
    map[key] = val;
  })

  return map; 
}

/*USE THIS FUNCTION
returns data containing map of key = employee name, value = total hours worked this month
*/
export const finalGetEmployeeHours = functions.https.onRequest((request, response) => {
  finalCalculateEmployeeHours().then(data => {
    response.status(200).send(data);
    return;
  }).catch(err => {
    console.error('Error retrieving list of calendars from account: ' + err.message); 
    response.status(500).send(ERROR_RESPONSE); 
    return;
  });
});




