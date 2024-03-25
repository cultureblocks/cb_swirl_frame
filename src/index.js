import { jsx as _jsx } from "hono/jsx/jsx-runtime";
import { serve } from '@hono/node-server';
import { Button, Frog, TextInput } from 'frog';
import 'hono/jsx';
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
    emulsifier: "",
    currentTurn: 0,
    turns: 6,
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
    text = text.replace(/&/g, "&amp;");
    text = text.replace(/</g, "&lt;");
    text = text.replace(/>/g, "&gt;");
    text = text.replace(/"/g, "&quot;");
    text = text.replace(/'/g, "&#x27;");
    text = text.replace(/\//g, "&#x2F;");
    return text;
}
async function synthesize(swirl, shortenMessage = "", counter = 0) {
    console.log(`counter = ${counter}`);
    if (counter > 5) {
        return "";
    }
    const context = "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.";
    const tokenBudget = 3000;
    const outputCharacterLimit = 1024;
    const contextPlusInspiration = `${context} ${shortenMessage} ${swirl.inspiration}`;
    const chunks = chunkAndCleanResponses(swirl.responses, tokenBudget);
    let synthesisResult = "";
    try {
        for (const chunk of chunks) {
            const completionBody = {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: `${contextPlusInspiration} ${swirl.emulsifier}` },
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
        `\nEmulsifier: ${swirl.emulsifier}`;
    const responsesWithExtras = fullText.split('\n').map((line, index) => (_jsx("div", { style: { color: shuffledColors[index % shuffledColors.length] }, children: line }, index)));
    return responsesWithExtras;
}
//// Frog
export const app = new Frog({
    basePath: '/swirl',
    browserLocation: 'https://cultureblocks.world',
    hub: neynar({ apiKey: process.env.NEYNAR_API_KEY ?? 'default_api_key' }),
    secret: process.env.FROG_SECRET
});
// Middleware
app.use(async (c, next) => {
    console.log(`Middleware [${c.req.method}]`);
    console.log(c.res.headers);
    await next();
});
// Intro Swirl Frame
const images = [
    "One.jpeg", "Two.jpeg", "Three.jpeg", "Four.jpeg", "Five.jpeg",
    "Six.jpeg", "Seven.jpeg", "Eight.jpeg", "Nine.jpeg", "Ten.jpeg",
    "Eleven.jpeg", "Twelve.jpeg", "Thirteen.jpeg", "Fourteen.jpeg", "Fifteen.jpeg",
    "Sixteen.jpeg", "Seventeen.jpeg", "Eighteen.jpeg", "Nineteen.jpeg", "Twenty.jpeg",
    "TwentyOne.jpeg", "TwentyTwo.jpeg", "TwentyThree.jpeg", "TwentyFour.jpeg", "TwentyFive.jpeg",
    "TwentySix.jpeg", "TwentySeven.jpeg", "TwentyEight.jpeg", "TwentyNine.jpeg", "Thirty.jpeg",
    "ThirtyOne.jpeg", "ThirtyTwo.jpeg", "ThirtyThree.jpeg", "ThirtyFour.jpeg", "ThirtyFive.jpeg"
];
function getRandomImage() {
    const randomIndex = Math.floor(Math.random() * images.length);
    const cacheBuster = Date.now();
    return `${process.env.IMG_URL_PREFIX}${images[randomIndex]}?cb=${cacheBuster}`;
}
app.frame('/', async (c) => {
    const randomImageUrl = getRandomImage();
    return c.res({
        image: randomImageUrl,
        imageOptions: {
            headers: {
                'Cache-Control': 'max-age=0'
            }
        },
        intents: [
            _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "Swirl" }),
            _jsx(Button, { action: "/block", value: "loadBlock", children: "Block" }),
        ],
    });
});
app.frame('/swirl', async (c) => {
    const { buttonValue, buttonIndex, frameData, inputText } = c;
    let sanitizedText;
    if (inputText !== undefined) {
        sanitizedText = sanitizeText(inputText);
    }
    else {
        sanitizedText = undefined;
    }
    const swirl = findSwirlDataByCastId(frameData?.castId.hash);
    if (swirl && swirl.currentTurn != 0) { // Swirl exists
        if (swirl.synthesis) { // Synth exists, no more messages
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
                    _jsx(Button, { action: "/swirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
        else if (buttonValue === "merge") { // Save response, show swirl, synthesize if all responses are in
            const newResponse = { fid: frameData?.fid, response: sanitizedText };
            const index = swirl.responses.findIndex(response => response.fid === newResponse.fid);
            if (index !== -1) {
                swirl.responses[index] = newResponse;
            }
            else {
                swirl.responses.push(newResponse);
            }
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
                    _jsx(Button, { action: "/swirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
        else if (!swirl.responses.some(response => response.fid === frameData?.fid)) { //If fid not in responses, User can respond
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
        else { // One message per user 
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
                    _jsx(TextInput, { placeholder: "One message per person..." }),
                    _jsx(Button, { action: "/swirl", value: "merge", children: "Replace Your Message" }),
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
    }
    else { // Swirl does not exist 
        if (frameData?.fid === frameData?.castId.fid) { // Creator can create 
            if (buttonValue === "loadSwirl") { // Creator can inspire 
                const text = `Inspiration sets the theme or focal point for responses. \n\n If left blank, who knows what could happen...`;
                const inspirationText = text.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
                return c.res({
                    image: (_jsx("div", { style: { backgroundColor: 'white', width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }, children: _jsx("div", { style: {
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
                            }, children: inspirationText }) })),
                    imageOptions: {
                        width: 600,
                        height: 600,
                    },
                    intents: [
                        _jsx(TextInput, { placeholder: "..." }),
                        _jsx(Button, { action: "/swirl", value: "inspiration", children: "Wow" }),
                        _jsx(Button, { action: "/swirl", value: "inspiration", children: "No" }),
                    ],
                });
            }
            else if (buttonValue === "inspiration") { // Creator can emulsify
                if (buttonIndex === 1 && sanitizedText !== undefined) {
                    swirl.inspiration = sanitizedText;
                }
                else {
                    swirl.inspiration = '';
                }
                swirl.castId = frameData?.castId.hash;
                swirl.creatorId = frameData?.castId.fid;
                saveSwirl(swirl);
                const text = `An emulsifier gives AI directions on what to do with the comments.\n\n If left blank, who knows what could happen...`;
                const emulsifierText = text.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
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
                        }, children: emulsifierText })),
                    imageOptions: { width: 600, height: 600 },
                    intents: [
                        _jsx(TextInput, { placeholder: "..." }),
                        _jsx(Button, { action: "/swirl", value: "emulsifier", children: "Wow" }),
                        _jsx(Button, { action: "/swirl", value: "emulsifier", children: "No" }),
                    ],
                });
            }
            else if (buttonValue === "emulsifier") { // Creator can confirm X //TESTING
                if (buttonIndex === 1 && sanitizedText !== undefined) {
                    swirl.emulsifier = sanitizedText;
                }
                else {
                    swirl.emulsifier = '';
                }
                saveSwirl(swirl);
                const text = `Inspiration: ${swirl.inspiration}\nEmulsifier: ${swirl.emulsifier}\n\nDoes this look good?`;
                const confirmText = text.split('\n').map((line, index) => (_jsx("div", { children: line }, index)));
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
                        }, children: confirmText })),
                    imageOptions: { width: 600, height: 600, headers: { 'Content-Type': 'image/svg+xml' } },
                    intents: [
                        _jsx(Button, { action: "/swirl", value: "confirm", children: "Yes" }),
                        _jsx(Button, { action: "/swirl", value: "loadSwirl", children: "No" }),
                    ],
                });
            }
            else { // Save new swirl, serve, accept message -> "merge" 
                swirl.currentTurn += 1;
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
        else { // Not creator, wait 
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
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
    }
});
app.frame('/block', async (c) => {
    const { buttonValue, frameData, inputText } = c;
    const swirl = findSwirlDataByCastId(frameData?.castId.hash);
    if (swirl.castId) { // swirl exists
        if (swirl.synthesis) { //synth + mint exist
            if (buttonValue === "rate") { //add a rating if haven't
                if (swirl.ratings.some(rating => rating.fid === frameData?.fid)) { // one rating per user
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
                            _jsx(Button, { action: "/block", children: "Block" }),
                        ],
                    });
                }
                else { //accept rating 
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
                        _jsx(Button, { action: "/block", children: "Block" }),
                    ],
                });
            }
            else if (buttonValue !== undefined && ["1", "2", "3", "4"].includes(buttonValue)) { // Save rating
                const rating = parseInt(buttonValue);
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
                        _jsx(Button, { action: "/swirl", children: "Swirl" }),
                        _jsx(Button, { action: "/block", children: "Block" }),
                    ],
                });
            }
            else { //show block
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
                        _jsx(Button, { action: "/swirl", children: "Swirl" }),
                        _jsx(Button, { action: "/block", value: "stats", children: "Stats" }),
                        // <Mint>, 
                    ],
                });
            }
        }
        else if (buttonValue === "creatorSynth") { // Synth early
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
                    _jsx(Button, { action: "/swirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
        else if (frameData?.fid === frameData?.castId.fid) { // Creator push synth?
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
                    _jsx(Button, { action: "/swirl", children: "No" }),
                ],
            });
        }
        else { // No synth yet.
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
                    _jsx(Button, { action: "/swirl", children: "Swirl" }),
                    _jsx(Button, { action: "/block", children: "Block" }),
                ],
            });
        }
    }
    else { // No swirl yet.
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
                _jsx(Button, { action: "/block", children: "Block" }),
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
