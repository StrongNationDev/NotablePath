require("dotenv").config();

const { Telegraf, Markup, session } = require("telegraf");
const { createClient } = require("@supabase/supabase-js");
const validator = require("validator");


// =========================
// CONFIG
// =========================


const bot = new Telegraf(
    process.env.BOT_TOKEN
);


const supabase = createClient(

    process.env.SUPABASE_URL,

    process.env.SUPABASE_KEY

);


const ADMIN_GROUP_ID =
    process.env.ADMIN_GROUP_ID;



// =========================
// SESSION STORAGE
// =========================


bot.use(session());



// =========================
// KEYBOARDS
// =========================


const mainMenu =
Markup.inlineKeyboard([

    [
        Markup.button.callback(
            "Start Assessment",
            "start"
        )
    ],

    [
        Markup.button.callback(
            "Learn About NotablePath",
            "about"
        )
    ],

    [
        Markup.button.callback(
            "Contact Consultant",
            "contact"
        )
    ]

]);




function requestButtons(){

return Markup.inlineKeyboard([

[
Markup.button.callback(
"I want to understand if I qualify for Wikipedia",
"qualified"
)
],

[
Markup.button.callback(
"I need help improving an existing article",
"existing_help"
)
],

[
Markup.button.callback(
"I need research/source analysis",
"research"
)
],

[
Markup.button.callback(
"I need guidance for a company or organization",
"company"
)
],

[
Markup.button.callback(
"I need guidance for a personal profile",
"profile"
)
],

[
Markup.button.callback(
"I'm not sure yet",
"unsure"
)
]

]);

}



function goalButtons(){

return Markup.inlineKeyboard([

[
Markup.button.callback(
"Build knowledge presence",
"knowledge"
)
],

[
Markup.button.callback(
"Improve existing information",
"improve"
)
],

[
Markup.button.callback(
"Understand Wikipedia requirements",
"requirements"
)
],

[
Markup.button.callback(
"Research my options",
"options"
)
],

[
Markup.button.callback(
"Other",
"other"
)
]

]);

}



function wikiButtons(){

return Markup.inlineKeyboard([

[
Markup.button.callback(
"Yes, an existing article",
"yes"
)
],

[
Markup.button.callback(
"No article yet",
"no"
)
],

[
Markup.button.callback(
"Not sure",
"unknown"
)
]

]);

}




function contactButtons(){

return Markup.inlineKeyboard([

[
Markup.button.callback(
"Telegram username",
"telegram"
)
],

[
Markup.button.callback(
"Email",
"email"
)
],

[
Markup.button.callback(
"Leave a message",
"message"
)
]

]);

}



// =========================
// START
// =========================


bot.start(async(ctx)=>{


await ctx.reply(

`Welcome to NotablePath Assessment Assistant.


NotablePath helps individuals and organizations understand Wikipedia requirements through research, source analysis, and professional consultation.


Wikipedia is built on reliable information and editorial standards, not advertising.


Answer a few questions and we will help you understand your next steps.


By continuing, you agree that NotablePath may use your submitted information only for consultation purposes.`,

mainMenu

);


});



// =========================
// BEGIN ASSESSMENT
// =========================


bot.action("start", async(ctx)=>{


ctx.session = {

step:"request_type"

};


await ctx.reply(

"What type of Wikipedia assistance are you looking for?",

requestButtons()

);


});



// =========================
// QUESTION 1
// =========================


bot.on("callback_query", async(ctx)=>{


const data = ctx.callbackQuery.data;



if(!ctx.session)
return;



if(ctx.session.step==="request_type"){


ctx.session.request_type=data;


ctx.session.step="subject";


await ctx.reply(

"What is the subject/topic?\n\nExamples:\nPerson\nCompany\nOrganization\nBook\nArtist"

);


}



else if(ctx.session.step==="goal"){


ctx.session.goal=data;


ctx.session.step="wiki_status";


await ctx.reply(

"Do you currently have Wikipedia coverage?",

wikiButtons()

);

}



else if(ctx.session.step==="wiki_status"){


ctx.session.wiki_status=data;


ctx.session.step="contact_type";


await ctx.reply(

"Where can our consultant contact you?",

contactButtons()

);


}



else if(ctx.session.step==="contact_type"){


ctx.session.contact_type=data;


ctx.session.step="contact_value";


await ctx.reply(

"Please provide your contact information."

);


}



});



// =========================
// TEXT HANDLER
// =========================


bot.on("text", async(ctx)=>{


if(!ctx.session)
return;



let text = ctx.message.text;



if(ctx.session.step==="subject"){


ctx.session.subject=text;

ctx.session.step="goal";


await ctx.reply(

"What is your main goal?",

goalButtons()

);


return;

}





if(ctx.session.step==="contact_value"){


if(
ctx.session.contact_type==="email"
&&
!validator.isEmail(text)

){

await ctx.reply(

"Please provide a valid email address."

);

return;

}



const user = ctx.from;



const lead = {


telegram_id:user.id,

username:user.username,

full_name:
`${user.first_name || ""} ${user.last_name || ""}`,

request_type:
ctx.session.request_type,

subject:
ctx.session.subject,

goal:
ctx.session.goal,

wiki_status:
ctx.session.wiki_status,

contact_type:
ctx.session.contact_type,

contact_value:text,

created_at:
new Date().toISOString()

};





await supabase

.from("assessments")

.insert(lead);






const adminMessage = `

New NotablePath Assessment


Name:
${lead.full_name}


Contact:
${text}


Request Type:
${lead.request_type}


Subject:
${lead.subject}


Goal:
${lead.goal}


Wikipedia Status:
${lead.wiki_status}


Date:
${new Date().toLocaleString()}

`;





await bot.telegram.sendMessage(

ADMIN_GROUP_ID,

adminMessage

);






await ctx.reply(

`Thank you for completing the assessment.


Your information has been received by NotablePath.


A consultant will review your request and provide guidance based on Wikipedia standards.`,

Markup.inlineKeyboard([

[
Markup.button.callback(
"Contact Consultant",
"contact"
)
]

])

);



ctx.session=null;



}



});




// =========================
// STATIC BUTTONS
// =========================


bot.action("about",async(ctx)=>{


await ctx.reply(

`NotablePath provides Wikipedia research, editing support, source analysis, and professional consultation.


We focus on Wikipedia standards, reliable sources, and ethical preparation.


We do not guarantee Wikipedia approval or bypass editorial policies.`

);


});




bot.action("contact",async(ctx)=>{


await ctx.reply(

"A NotablePath consultant will review your request and follow up."

);


});




// =========================
// ERROR HANDLING
// =========================


bot.catch((err)=>{


console.error(
"Bot Error:",
err
);


});



// =========================
// START BOT
// =========================


bot.launch();


console.log(
"NotablePath Assessment Assistant running..."
);



// Graceful shutdown

process.once(
"SIGINT",
()=>bot.stop("SIGINT")
);


process.once(
"SIGTERM",
()=>bot.stop("SIGTERM")
);