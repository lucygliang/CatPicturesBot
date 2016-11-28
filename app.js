/*
This bot waits patiently for the user to request a cat picture and then picks one at random from http://thecatapi.com/ for his/her viewing pleasure!

Created using:
   - Microsoft's Bot Framework (https://docs.botframework.com/)
   - BotBuilder for Node.js (https://github.com/Microsoft/BotBuilder, https://docs.botframework.com/en-us/node/builder/overview/)
   - The Cat API (http://thecatapi.com/)
   - LUIS - Language Understanding Intelligent Service (https://www.luis.ai/)
*/

var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server for local debugging
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

// Create LUIS recognizer that points to the intent detection model (trained via https://www.luis.ai/).
// Add "&verbose=true" to the end of the url as a workaround for https://github.com/Microsoft/BotBuilder/issues/1633.
var model = "https://api.projectoxford.ai/luis/v2.0/apps/" + process.env.LUIS_APP_ID + "?subscription-key=" + process.env.LUIS_APP_KEY + "&verbose=true";
var recognizer = new builder.LuisRecognizer(model);
var intentDialog = new builder.IntentDialog({ recognizers: [recognizer] });

// Add intent handlers
intentDialog.onDefault(builder.DialogAction.send("How embarrassing! I didn't understand that. I'm still a young bot. >^-.-^< If you would like a cat picture, try asking for one!"));
intentDialog.matches("Greeting", [
    function (session, args) {
        session.beginDialog('/greeting');
    }
]);
intentDialog.matches("RequestObject", [
    function (session, args) {
        session.beginDialog('/request', args);
    }
]);
intentDialog.matches("Like", builder.DialogAction.send("Yay! I'm glad you like this. I have more cats for you. :)"));
intentDialog.matches("Dislike", builder.DialogAction.send("Oh no! I'm sorry you don't like this. We can try another cat. :("));

var http = require("https");
var options = {
    host: "thecatapi.com",
    path: "/api/images/get?format=xml"
};

var catSynonyms = ["CAT", "KITTY", "KITTEN", "FELINE", "MEOW"];
var pictureSynonyms = ["PICTURE", "PHOTO", "PHOTOGRAPH", "IMAGE", "PIC", "PICCY", "PIX", "SNAPSHOT"];
var deliveryPhrases = [
    "Here's your cat!", "One cat coming right up!", "Ask and you shall receive. Meow!", "I picked this cat just for you.",
    "I think you will like this one.", "There you go! One cat.", "Here's a cat for you!"]

//=========================================================
// Bots Dialogs
//=========================================================
bot.dialog('/', intentDialog);

bot.dialog('/greeting', [
    function (session) {
        if (!session.userData.introComplete) {
            session.userData.introComplete = true;
            session.endDialog(session, "Meow! >^o.o^< I have pictures of cats that I think you'll love. Just ask me for a cat picture!");
        } else {
            session.endDialog("Meow! I feel good and hope you do too. >^o_o^<");
        }
    }
]);

bot.dialog("/request", [
    function (session, args) {
        var shouldGetCatPicture = true;
        var requestedObject = builder.EntityRecognizer.findEntity(args.entities, "Object"); // The requested object, like "cat"
        var requestedMedium = builder.EntityRecognizer.findEntity(args.entities, "Medium"); // The requested medium, like "picture"

        if (requestedObject) {
            shouldGetCatPicture = (requestedMedium) ?
                // If both object and medium exist, verify object is a cat and medium is a picture.
                verifyEntity(requestedObject, catSynonyms, session, "I only have pictures of cats. So how about a cat? Try asking for a cat picture.") &&
                verifyEntity(requestedMedium, pictureSynonyms, session, "I only have cat pictures. So how about a picture? Try asking for a cat picture.") :
                // If only object exists, verify that it is either a cat or a picture.
                verifyEntity(requestedObject, catSynonyms.concat(pictureSynonyms), session, "I only have cat pictures. Try asking for a cat picture.");     
        }
        else if (requestedMedium) {
            // If only medium exists, verify that it is a picture.
            shouldGetCatPicture =
                verifyEntity(requestedMedium, pictureSynonyms, session, "I only have cat pictures. So how about a picture? Just ask for a cat picture.");
        }
        else {
            // Must have at least a an object or a medium.
            session.endDialog("I only have cat pictures. Try asking for a cat picture.");
            shouldGetCatPicture = false;
        }
        
        // Create callback for response from TheCatApi.
        callback = function(response) {
            var responseXML = "";
            response.on("data", function (chunk) {
                responseXML += chunk;
            })

            response.on("end", function() {
                // TheCatApi returns XML, so convert to JSON then parse.
                var responseJSON;
                var parseString = require("xml2js").parseString;
                parseString(responseXML, function (err, result) {
                    responseJSON = JSON.stringify(result);
                });
                var jsonObject = JSON.parse(responseJSON);

                // Assume at least one cat picture exists. Since we're doing a random selection from the
                // entire cat database, this is a safe assumption. Also call String constructor, since image
                // attachment won't work below for some channels unless catImageUrl is explicitly a string.
                var catImageUrl = String(jsonObject.response.data[0].images[0].image[0].url);

                var msg = new builder.Message(session)
                    .text(deliveryPhrases[Math.floor(Math.random()*deliveryPhrases.length)]) // Pick a random phrase from the list.
                    .attachments([{
                        contentType: "image/jpeg",
                        contentUrl: catImageUrl
                    }]);
                session.endDialog(msg);
            })
        };

        // Now call TheCatAPI.
        http.request(options, callback).end();
    }
]);

function verifyEntity(requestedEntityObject, synonymsList, session, invalidEntityMessage) {
    // Convert to all uppercase and remove trailing 's' and 'z' to account for plural words.
    // No need to remove trailing punctuation since LUIS will handle that.
    var wordToCheck = requestedEntityObject.entity.toUpperCase().replace(/[sz]$/ig, "");
    if (synonymsList.indexOf(wordToCheck) < 0)
    {
        session.endDialog(invalidEntityMessage);
        return false;
    }
    return true;
}