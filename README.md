# CS4261

## How to Use
1. Make sure you have a Google account.
2. Go to payroll-10.web.app
3. Login with your Google account
4. The first time you go to the payroll screen (and this might take a bit) you should be redirected to another Google sign-in page so you can give the app access to your Google Calendars. If you get a message saying the app isn't verified, click on the small button that says "Advanced" and then click on "Go to Paysense Payroll (unsafe)". It isn't unsafe, but we haven't been verified by Google yet. Finally, click the "Allow" button to give us access to your Calendars.
5. Add all your employees from the "Manage Employees" page.
6. Use your Google Calendar to add employee hours. Here is a video to learn how to do that: https://www.youtube.com/watch?v=Rm6tq5AzsaU
7. Run payrolls for your pay periods.

## How to Contribute
1. Install [NodeJS](https://nodejs.org/en/download/).
2. Install `firebase-tools` for the Firebase CLI with the command `npm install -g firebase-tools`.
3. Make sure you have access to the project's Firebase console.
4. Login to `firebase-tools` with the command `firebase login`.

To run the application hosting locally, run
```
firebase serve --only hosting
```
and the hosting should happen at `http://localhost:5000`.

To run the Firebase Functions locally, run
```
cd functions
npm run serve
```
which will cause the functions to have a base url of `http://localhost:5001/payroll-10/us-central1/`. For example, the `helloWorld` function is located at `http://localhost:5001/payroll-10/us-central1/helloWorld`.
