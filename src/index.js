import { jsx as _jsx } from "hono/jsx/jsx-runtime";
import { serve } from '@hono/node-server';
import { Button, Frog, TextInput } from 'frog';
import fs from 'fs';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { neynar } from 'frog/hubs';
dotenv.config();
// Create an instance of the OpenAI client
const openai = new OpenAI.OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
//// Swirl data
const swirlJson = 'src/swirlsData.json';
// Define an empty swirl object
const emptySwirl = {
    castId: "",
    creatorId: 0,
    inspiration: "",
    modifier: "",
    currentTurn: 0,
    turns: 0,
    responses: [],
    synthesis: "",
    ratings: [],
    mintLink: ""
};
// Search JSON for a specific castId, return swirl
function findSwirlDataByCastId(targetCastId) {
    try {
        const data = loadSwirls(swirlJson);
        for (const swirl of data.swirls) {
            if (swirl.castId === targetCastId) {
                return swirl;
            }
        }
        return emptySwirl;
    }
    catch (err) {
        console.error('Error reading JSON file:', err);
        return emptySwirl;
    }
}
// Append new swirl to JSON
function saveSwirl(newSwirl) {
    try {
        const existingData = loadSwirls(swirlJson) || { swirls: [] };
        const index = existingData.swirls.findIndex(swirl => swirl.castId === newSwirl.castId);
        if (index !== -1) {
            existingData.swirls[index] = newSwirl;
        }
        else {
            existingData.swirls.push(newSwirl);
        }
        fs.writeFileSync(swirlJson, JSON.stringify(existingData, null, 2));
        console.log('Data saved to JSON file successfully.');
    }
    catch (err) {
        console.error('Error saving to JSON file:', err);
    }
}
// Read data from JSON
function loadSwirls(filename) {
    try {
        const data = fs.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    }
    catch (err) {
        console.error('Error reading from JSON file:', err);
        return null;
    }
}
// Get Synthesis 
function sanitizeText(text) {
    text = text.replace(/\s+/g, " ");
    text = text.replace(/([^'])'(?!\s|$)/g, "$1'");
    text = text.replace(/(?<!\S)"(?!\S)/g, "\"");
    text = text.replace(/<[^>]*>/g, "");
    text = escapeSpecialCharacters(text);
    return text;
}
function escapeSpecialCharacters(text) {
    const specialCharacters = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
        "/": "&#x2F;"
    };
    return text.replace(/[&<>"'/]/g, (match) => specialCharacters[match]);
}
async function synthesize(swirl, shortenMessage = "", counter = 0) {
    console.log(`counter = ${counter}`);
    if (counter > 5) {
        console.log("I couldn't get the synthesis short enough, sorry!");
        return "";
    }
    const model = "gpt-3.5-turbo";
    const context = "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.";
    const tokenBudget = 3000;
    const outputCharacterLimit = 1024;
    const contextPlusInspiration = `${context} ${shortenMessage} ${swirl.inspiration}`;
    const chunks = chunkAndCleanResponses(swirl.responses, tokenBudget);
    let synthesisResult = "";
    try {
        console.log(`Chunkssss = ${chunks}`);
        for (const chunk of chunks) {
            console.log(`Chunk = ${chunk}`);
            const completionBody = {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: `${contextPlusInspiration} ${swirl.modifier}` },
                    { role: "user", content: chunk }
                ],
            };
            console.log(`Synthesizing...${JSON.stringify(completionBody)}`);
            const completionResponse = await openai.chat.completions.create(completionBody);
            const completionText = completionResponse.choices[0].message.content;
            if (completionText && completionText.length > outputCharacterLimit) {
                console.log("Synthesis too long, resynthesizing...");
                counter++;
                return synthesize(swirl, "make it short and concise and meaningful", counter);
            }
            else {
                synthesisResult += completionText;
                console.log(`Synthesis result = ${synthesisResult}`);
            }
        }
        console.log(`Final synthesis = ${synthesisResult}`);
        return synthesisResult;
    }
    catch (e) {
        console.error(`Error with synthesizing: ${e}`);
        return "";
    }
}
function chunkAndCleanResponses(responses, maxChunkSize) {
    const result = [];
    let currentChunk = "";
    for (const { response } of responses) {
        if (response === undefined) {
            continue;
        }
        const cleanedResponse = response.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim() + ". ";
        if (currentChunk.length + cleanedResponse.length > maxChunkSize) {
            result.push(currentChunk);
            currentChunk = cleanedResponse;
        }
        else {
            currentChunk += cleanedResponse;
        }
    }
    if (currentChunk.length > 0) {
        result.push(currentChunk);
    }
    console.log(`+_+_+_+_+_+__+_+_+_+_+_+_+__result = ${result}`);
    console.log(`Chunked responses = ${result.join('')}`);
    return result;
}
function calculateAverages(responses, ratings) {
    const validResponses = responses.filter(response => response !== undefined && response.fid !== undefined);
    const validRatings = ratings.filter(rating => rating !== undefined && rating.fid !== undefined && rating.rating !== undefined);
    const totalSum = validRatings.reduce((acc, curr) => acc + (curr.rating ?? 0), 0);
    const totalAverage = validRatings.length > 0 ? totalSum / validRatings.length : 0;
    const participantRatings = validRatings.filter(rating => validResponses.some(response => response.fid === rating.fid));
    const participantSum = participantRatings.reduce((acc, curr) => acc + (curr.rating ?? 0), 0);
    const participantAverage = participantRatings.length > 0 ? participantSum / participantRatings.length : 0;
    return { participantAverage, totalAverage };
}
function renderSwirlWithUniqueColors(swirl) {
    // Predefined set of distinct colors
    const colors = [
        '#900C3F', '#FFC300', '#581845', '#4CBB17', '#3333FF',
        '#FD6C9E', '#17A2B8', '#FF5733', '#808000', '#4682B4',
        '#008080', '#6A5ACD', '#800080', '#008000', '#C70039'
    ];
    const shuffleArray = (array) => {
        const shuffled = array.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };
    const shuffledColors = shuffleArray(colors);
    const fullText = `Inspiration: ${swirl.inspiration}\n` +
        swirl.responses.map(item => item.response).join('\n') +
        `\nModifier: ${swirl.modifier}`;
    const responsesWithExtras = fullText.split('\n').map((line, index) => (_jsx("div", { style: { color: shuffledColors[index % shuffledColors.length] }, children: line }, index)));
    return responsesWithExtras;
}
//// Frog
export const app = new Frog({
    basePath: '/swirl',
    browserLocation: 'https://gov.optimism.io/t/looking-for-feedback-hedgey-using-our-50k-op-rpgf-to-fund-four-new-projects-launching-natively-on-optimism/7660/20',
    headers: {
        'Cache-Control': 'max-age=0',
    },
    initialState: {
        castId: "",
        creatorId: 0,
        inspiration: "",
        modifier: "",
        currentTurn: 0,
        turns: 6,
        responses: [],
        synthesis: "",
        ratings: [],
        mintLink: ""
    },
    hub: neynar({ apiKey: 'NEYNAR_FROG_FM' }),
    verify: true,
    secret: process.env.FROG_SECRET
});
// Middleware
app.use(async (c, next) => {
    console.log(`Middleware [${c.req.method}] ${c.req.url}`);
    await next();
});
// Intro Swirl Frame
const images = [
    "http://cultureblocks.world/images/imageOne.jpeg",
    "http://cultureblocks.world/images/imageTwo.jpeg",
    "http://cultureblocks.world/images/imageThree.jpeg",
    "http://cultureblocks.world/images/imageFour.jpeg",
    "http://cultureblocks.world/images/imageFive.jpeg",
    "http://cultureblocks.world/images/imageSix.jpeg",
    "http://cultureblocks.world/images/imageSeven.jpeg",
    "http://cultureblocks.world/images/imageEight.jpeg",
    "http://cultureblocks.world/images/imageNine.jpeg",
    "http://cultureblocks.world/images/imageTen.jpeg",
    "http://cultureblocks.world/images/imageEleven.jpeg",
    "http://cultureblocks.world/images/imageTwelve.jpeg",
    "http://cultureblocks.world/images/imageThirteen.jpeg",
    "http://cultureblocks.world/images/imageFourteen.jpeg",
    "http://cultureblocks.world/images/imageFifteen.jpeg",
    "http://cultureblocks.world/images/imageSixteen.jpeg",
    "http://cultureblocks.world/images/imageSeventeen.jpeg",
    "http://cultureblocks.world/images/imageEighteen.jpeg",
    "http://cultureblocks.world/images/imageNineteen.jpeg",
    "http://cultureblocks.world/images/imageTwenty.jpeg",
    "http://cultureblocks.world/images/imageTwentyOne.jpeg",
    "http://cultureblocks.world/images/imageTwentyTwo.jpeg",
    "http://cultureblocks.world/images/imageTwentyThree.jpeg",
    "http://cultureblocks.world/images/imageTwentyFour.jpeg",
    "http://cultureblocks.world/images/imageTwentyFive.jpeg",
    "http://cultureblocks.world/images/imageTwentySix.jpeg",
    "http://cultureblocks.world/images/imageTwentySeven.jpeg",
    "http://cultureblocks.world/images/imageTwentyEight.jpeg",
    "http://cultureblocks.world/images/imageTwentyNine.jpeg",
    "http://cultureblocks.world/images/imageThirty.jpeg",
    "http://cultureblocks.world/images/imageThirtyOne.jpeg",
    "http://cultureblocks.world/images/imageThirtyTwo.jpeg",
    "http://cultureblocks.world/images/imageThirtyThree.jpeg",
    "http://cultureblocks.world/images/imageThirtyFour.jpeg",
    "http://cultureblocks.world/images/imageThirtyFive.jpeg"
];
function getRandomImage() {
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
}
app.frame('/', async (c) => {
    console.log("-----------frame at initial cast");
    const randomImageUrl = getRandomImage();
    return c.res({
        image: randomImageUrl,
        intents: [
            _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Swirl" }),
            _jsx(Button, { action: "/block", value: "create", children: "Block" }),
        ],
    });
});
app.frame('/swirl', async (c) => {
    const { buttonValue, frameData, deriveState, inputText } = c;
    let sanitizedText;
    if (inputText !== undefined) {
        sanitizedText = sanitizeText(inputText);
    }
    else {
        sanitizedText = undefined;
    }
    const state = await deriveState(async (previousState) => { });
    const swirl = findSwirlDataByCastId(frameData?.castId.hash);
    if (swirl.castId) { // Swirl exists
        console.log("-------- swirl in json");
        if (swirl.synthesis) { // Synth exists, no more messages X
            console.log("------- synthesis exists, no more messages");
            const swirlContent = renderSwirlWithUniqueColors(swirl);
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: swirlContent })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", value: "swirl", children: "Block" }),
                ],
            });
        }
        else if (buttonValue === "merge") { // Save and serve, synth if last turn
            console.log("--------save and serve");
            const newResponse = { fid: frameData?.fid, response: sanitizedText };
            const index = state.responses.findIndex(response => response.fid === newResponse.fid);
            if (index !== -1) {
                state.responses[index] = newResponse;
            }
            else {
                state.responses.push(newResponse);
            }
            swirl.responses = state.responses;
            swirl.currentTurn += 1;
            saveSwirl(swirl);
            if (swirl.responses.length === swirl.turns) {
                const synthesis = await synthesize(swirl, "", 0);
                swirl.synthesis = synthesis;
                saveSwirl(swirl);
            }
            const swirlContent = renderSwirlWithUniqueColors(swirl);
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: swirlContent })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", value: "swirl", children: "Block" }),
                ],
            });
        }
        else if (!swirl.responses.some(response => response.fid === frameData?.fid)) { //If fid not in responses, User can respond
            console.log("------- user can respond");
            const swirlContent = renderSwirlWithUniqueColors(swirl);
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: swirlContent })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(TextInput, { placeholder: "Add some flavor..." }),
                    _jsx(Button, { action: "/swirl", value: "merge", children: "Merge" }),
                ],
            });
        }
        else { // One message per user X
            console.log("------- one message per user");
            const swirlContent = renderSwirlWithUniqueColors(swirl);
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: swirlContent })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(TextInput, { placeholder: "One message per account..." }),
                    _jsx(Button, { action: "/swirl", value: "merge", children: "Replace Your Message" }),
                    _jsx(Button, { action: "/block", value: "swirl", children: "Block" }),
                ],
            });
        }
    }
    else { // Swirl does not exist X
        console.log("-------- swirl not in json");
        if (frameData?.fid === frameData?.castId.fid) { // Creator can create X
            console.log("--------creator can create");
            if (buttonValue === "loadSwirl") { // Creator can inspire X
                console.log("--------creator can inspire");
                const needsLineBreak = `Inspiration sets the theme or focal point for responses. \n\n If left blank, who knows what could happen...`;
                const inspiration = needsLineBreak.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: inspiration })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(TextInput, { placeholder: "..." }),
                        _jsx(Button, { action: "/swirl", value: "inspiration", children: "Wow" }),
                        _jsx(Button, { action: "/swirl", value: "inspiration", children: "No" }),
                    ],
                });
            }
            else if (buttonValue === "inspiration") { // Creator can modify X
                console.log("--------creator can modify");
                if (typeof sanitizedText === 'string' && sanitizedText.trim().length > 0) {
                    state.inspiration = sanitizedText;
                }
                else {
                    state.inspiration = '';
                }
                const needsLineBreak = `An emulsifier gives AI directions on what to do with the comments.\n\n If left blank, who knows what could happen...`;
                const emulsifier = needsLineBreak.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: emulsifier })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(TextInput, { placeholder: "..." }),
                        _jsx(Button, { action: "/swirl", value: "modifier", children: "Wow" }),
                        _jsx(Button, { action: "/swirl", value: "modifier", children: "No" }),
                    ],
                });
            }
            else if (buttonValue === "modifier") { // Creator can confirm X
                console.log("--------creator can confirm");
                if (typeof sanitizedText === 'string' && sanitizedText.trim().length > 0) {
                    state.modifier = sanitizedText;
                }
                else {
                    state.modifier = '';
                }
                const needsLineBreak = `Inspiration: ${state.inspiration}\nModifier: ${state.modifier}\n\nDoes this look good?`;
                const lookGood = needsLineBreak.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: lookGood })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(Button, { action: "/swirl", value: "confirm", children: "Yes" }),
                        _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "No" }),
                    ],
                });
            }
            else { // Save new swirl, serve, accept message -> "merge" X
                console.log("--------save and serve creator");
                swirl.castId = frameData?.castId.hash;
                swirl.creatorId = frameData?.fid;
                swirl.inspiration = state.inspiration;
                swirl.modifier = state.modifier;
                swirl.currentTurn += 1;
                swirl.turns = 6;
                saveSwirl(swirl);
                const swirlContent = renderSwirlWithUniqueColors(swirl);
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: swirlContent })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(TextInput, { placeholder: "Add some flavor..." }),
                        _jsx(Button, { action: "/swirl", value: "merge", children: "Merge" }),
                    ],
                });
            }
        }
        else { // Not creator, wait X
            console.log("--------wait for creation");
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: "The Swirl has not started yet. Check back soon." })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Soon" }),
                    _jsx(Button, { action: "/block", value: "swirl", children: "Block" }),
                ],
            });
        }
    }
});
app.frame('/block', async (c) => {
    const { buttonValue, frameData, deriveState, inputText } = c;
    const state = await deriveState(async (previousState) => { });
    const swirl = findSwirlDataByCastId(frameData?.castId.hash);
    if (swirl.castId) { // swirl exists
        console.log("========= swirl exists");
        if (swirl.synthesis) { //synth + mint exist. /swirl "block" swirl /block "stats" block stats /mint
            console.log("========= synth exists");
            if (buttonValue === "rate") { //add a rating if haven't
                console.log("========= rating");
                if (swirl.ratings.some(rating => rating.fid === frameData?.fid)) { // one rating per user
                    console.log("========= one rating per user");
                    return c.res({
                        image: (_jsx("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'black',
                                background: 'white',
                                width: '100%',
                                height: '100%',
                                padding: '30px',
                                textAlign: 'center',
                                boxSizing: 'border-box',
                            }, children: "One rating per user." })),
                        imageOptions: { width: 600, height: 600 },
                        intents: [
                            _jsx(Button, { action: "/block", value: "stats", children: "Stats" }),
                            _jsx(Button, { action: "/block", value: "block", children: "Block" }),
                        ],
                    });
                }
                else { //accept rating /block "stats" block stats
                    console.log("========= enter rating");
                    return c.res({
                        image: (_jsx("div", { style: {
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'black',
                                background: 'white',
                                width: '100%',
                                height: '100%',
                                padding: '30px 30px',
                                textAlign: 'center',
                                boxSizing: 'border-box',
                            }, children: "Rate the Block." })),
                        imageOptions: { width: 600, height: 600 },
                        intents: [
                            _jsx(Button, { action: "/block", value: "1", children: "1" }),
                            _jsx(Button, { action: "/block", value: "2", children: "2" }),
                            _jsx(Button, { action: "/block", value: "3", children: "3" }),
                            _jsx(Button, { action: "/block", value: "4", children: "4" }),
                        ],
                    });
                }
            }
            else if (buttonValue === "stats") { //show stats
                console.log("========= stats");
                const { participantAverage, totalAverage } = calculateAverages(swirl.responses, swirl.ratings);
                const stats = `Participant average rating: ${participantAverage.toFixed(2)}\nTotal average rating: ${totalAverage.toFixed(2)}`;
                const statsLines = stats.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: statsLines })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(Button, { action: "/block", value: "rate", children: "Rate" }),
                        _jsx(Button, { action: "/block", value: "block", children: "Block" }),
                    ],
                });
            }
            else if (buttonValue !== undefined && ["1", "2", "3", "4"].includes(buttonValue)) { // Check if buttonValue is "1", "2", "3", or "4"
                console.log("========= save new rating");
                const rating = parseInt(buttonValue);
                state.ratings.push({ fid: frameData?.fid, rating });
                swirl.ratings.push({ fid: frameData?.fid, rating });
                saveSwirl(swirl);
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '30px 30px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: "Your rating has been saved." })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(Button, { action: "/swirl", value: "block", children: "Swirl" }),
                        _jsx(Button, { action: "/block", value: "block", children: "Block" }),
                    ],
                });
            }
            else { //show block /swirl "block" swirl /block "stats" block
                console.log("========= show block");
                return c.res({
                    image: (_jsx("div", { style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'black',
                            background: 'white',
                            width: '100%',
                            height: '100%',
                            padding: '10px 10px',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                        }, children: swirl.synthesis })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(Button, { action: "/swirl", value: "block", children: "Swirl" }),
                        _jsx(Button, { action: "/block", value: "stats", children: "Stats" }),
                        // <Mint>, 
                    ],
                });
            }
        }
        else if (buttonValue === "creatorSynth") { // Synth early
            console.log("========= synth early");
            const synthesis = await synthesize(swirl, "", 0);
            swirl.synthesis = synthesis;
            saveSwirl(swirl);
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: swirl.synthesis })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/swirl", value: "block", children: "Swirl" }),
                    _jsx(Button, { action: "/block", value: "block", children: "Block" }),
                ],
            });
        }
        else if (frameData?.fid === frameData?.castId.fid) { // Creator push synth?
            console.log("========= creator synth?");
            const turnsLeft = `This swirl has ${swirl.turns - swirl.responses.length} turns left. Would you like to end it now and synthesize the responses? The frame might freeze for a bit while it synthesizes the responses.`;
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: turnsLeft })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/block", value: "creatorSynth", children: "Yes" }),
                    _jsx(Button, { action: "/swirl", value: "block", children: "No" }),
                ],
            });
        }
        else { // No synth yet. /swirl "block" swirl /block "block" block
            console.log("========= no synth yet");
            return c.res({
                image: (_jsx("div", { style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'black',
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        padding: '30px 30px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                    }, children: "The Swirl has not finished. Check back soon." })),
                imageOptions: { width: 600, height: 600 },
                intents: [
                    _jsx(Button, { action: "/swirl", value: "block", children: "Swirl" }),
                    _jsx(Button, { action: "/block", value: "block", children: "Block" }),
                ],
            });
        }
    }
    else { // No swirl yet. /swirl "block" swirl /block "block" block
        console.log("========= no swirl yet");
        return c.res({
            image: (_jsx("div", { style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'black',
                    background: 'white',
                    width: '100%',
                    height: '100%',
                    padding: '30px 30px',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                }, children: "The Swirl has not started yet. Check back soon." })),
            imageOptions: { width: 600, height: 600 },
            intents: [
                _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Swirl" }),
                _jsx(Button, { action: "/block", value: "block", children: "Block" }),
            ],
        });
    }
});
const port = 3000;
console.log(`Server is running on port ${port}`);
serve({
    fetch: app.fetch,
    port,
});
