/*
This bot waits patiently for the user to request a cat picture and then picks one at random from http://thecatapi.com/ for his/her viewing pleasure!

Created using:
   - Microsoft's Bot Framework (https://docs.botframework.com/)
   - BotBuilder for Node.js (https://github.com/Microsoft/BotBuilder, https://docs.botframework.com/en-us/node/builder/overview/)
   - The Cat API (http://thecatapi.com/)
*/

var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

var http = require("https");
var options = {
    host: "thecatapi.com",
    path: "/api/images/get?format=xml"
};

//=========================================================
// Bots Dialogs
//=========================================================

bot.dialog('/', [
    function (session, args, next) {
        if (!session.userData.introComplete) {
            session.beginDialog('/intro');
        } else {
            next();
        }
    },
    function (session, result) {
        callback = function(response) {
            var responseXML = "";
            response.on("data", function (chunk) {
                responseXML += chunk;
            })

            response.on("end", function() {
                // TheCatApi returns XML, so convert to JSON then parse.
                var responseJSON;
                var parseString = require('xml2js').parseString;
                parseString(responseXML, function (err, result) {
                    responseJSON = JSON.stringify(result);
                });

                var jsonObject = JSON.parse(responseJSON);

                // Assume at least one cat picture exists. Since we're doing a random selection from the
                // entire cat database, this is a safe assumption.
                var catImageUrl = jsonObject.response.data[0].images[0].image[0].url;

                var msg = new builder.Message(session)
                    .text("Here is your cat!")
                    .attachments([{
                        contentType: "image/jpeg",
                        contentUrl: catImageUrl.toString()
                    }]);
                session.send(msg);
            }) 
        };

        http.request(options, callback).end();
    }
]);

bot.dialog('/intro', [
    function (session) {
        builder.Prompts.text(session, "Meow! >^o.o^< I have pictures of cats that I think you'll love. Just ask me for a cat picture!");
    },
    function (session, results) {
        session.userData.introComplete = true;
        session.endDialog();
    }
]);