# CS4261

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
