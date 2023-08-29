/* eslint-disable max-len */
/* eslint-disable camelcase */
/* eslint-disable no-unsafe-optional-chaining */
import * as functions from "firebase-functions";
import fetch from "node-fetch";
import {createTestAccount,
  createTransport, getTestMessageUrl} from "nodemailer";
import SMTPTransport = require("nodemailer/lib/smtp-transport");

/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

const GET_PHOTO_QUERY = `query GetPhoto($id:uuid!) {
    photos_by_pk(id: $id) {
      photo_url
      description
    }
  }
  `;

export const notifyAboutComment = functions.https.onRequest(
  async (request, response) => {
    try {
      const {event} = request.body;
      const {photo_id, comment} = event?.data?.new;
      const {session_variables} = event;

      const photoInfoQuery = await fetch("http://localhost:8080/v1/graphql", {
        method: "POST",
        body: JSON.stringify({
          query: GET_PHOTO_QUERY,
          variables: {id: photo_id},
        }),
        headers: {...session_variables, ...request.headers},
      });

      interface PhotoInfoResponse {
        data: {
            photos_by_pk: {
                photo_url: string;
                description: string;
            };
        };
    }
      const {
        data: {
          photos_by_pk: {photo_url, description},
        },
      } = await photoInfoQuery.json() as PhotoInfoResponse;

      //   interface PhotoInfoResponse {
      //     photo_url: string;
      //     description: string;
      // }

      //   const responseData: PhotoInfoResponse = await photoInfoQuery.json();
      //   const {photo_url, description} = responseData;

      // const {photo_url} = responseData.photo_url;
      // const {description} = responseData.description;

      const testAccount = await createTestAccount();
      const transporter = createTransport({
        host: "smpt.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          used: testAccount.user,
          pass: testAccount.pass,
        },
      } as SMTPTransport.Options);

      const sentEmail = await transporter.sendMail({
        from: `"Firebase Function" <${testAccount.user}>`,
        to: "dmytro.mezhensky@gmail.com",
        subject: "New Comment to Photo",
        html: `<html>
          <head>
            <body>
                <h3>Hi there;</h3><br><br>
                <p>You have got a new comment to your photo: <a href="${photo_url}"> ${description}</a></p>
                <p>The Comment is: <i>${comment}</i></p>
            </body>
          </head>
          </html>`,
      });

      functions.logger.log(getTestMessageUrl(sentEmail));

      response.status(200).send({message: "success"});
    } catch (error) {
      if (error instanceof Error) {
        response.status(500).send({message: `Message ${error.message}`});
      } else {
        response.status(501).send("Unexpected error");
      }
    }
    // functions.logger.info("Request body", request.body);
    // response.send("Hello from Firebase!");
  });
