import { serve } from '@hono/node-server';
import { Button, Frog, TextInput } from 'frog';
import  'hono/jsx'
import fs from 'fs';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { ChatCompletionCreateParamsNonStreaming } from 'openai/resources/index.mjs';
import { neynar } from 'frog/hubs'

dotenv.config();

// Create an instance of the OpenAI client
const openai = new OpenAI.OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


//// Swirl data

const swirlJson: string = 'src/swirlsData.json';

interface SwirlsData {
  swirls: Swirl[];
}

interface Swirl {
  castId: string | undefined;
  creatorId: number | undefined;
  inspiration: string | undefined;
  emulsifier: string | undefined;
  currentTurn: number;
  turns: number;
  responses: { fid: number | undefined; response: string | undefined }[];
  synthesis: string | undefined;
  ratings: { fid: number | undefined; rating: number | undefined }[];
  mintLink: string | undefined;
}

// Define an empty swirl object
const emptySwirl: Swirl = {
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
function findSwirlDataByCastId(targetCastId: string | undefined): Swirl {
  try {
      const data: SwirlsData = loadSwirls(swirlJson)!;
      for (const swirl of data.swirls) {
          if (swirl.castId === targetCastId) {
              return swirl; 
          }
      }
      return emptySwirl;
  } catch (err) {
      console.error('Error reading JSON file:', err);
      return emptySwirl;
  }
}

// Append new swirl to JSON
function saveSwirl(newSwirl: Swirl): void {
  try {
      const existingData: SwirlsData = loadSwirls(swirlJson) || { swirls: [] };
      const index = existingData.swirls.findIndex(swirl => swirl.castId === newSwirl.castId);
      if (index !== -1) {
          existingData.swirls[index] = newSwirl;
      } else {
          existingData.swirls.push(newSwirl);
      }
      fs.writeFileSync(swirlJson, JSON.stringify(existingData, null, 2));
      console.log('Data saved to JSON file successfully.');
  } catch (err) {
      console.error('Error saving to JSON file:', err);
  }
}

// Read data from JSON
function loadSwirls(filename: string): SwirlsData | null {
  try {
      const data: string = fs.readFileSync(filename, 'utf8');
      return JSON.parse(data) as SwirlsData;
  } catch (err) {
      console.error('Error reading from JSON file:', err);
      return null;
  }
}


// Get Synthesis 

function sanitizeText(text: string): string {
  text = text.replace(/\s+/g, " ");
  text = text.replace(/&/g, "&amp;");
  text = text.replace(/</g, "&lt;");
  text = text.replace(/>/g, "&gt;");
  text = text.replace(/"/g, "&quot;");
  text = text.replace(/'/g, "&#x27;");
  text = text.replace(/\//g, "&#x2F;");
  return text;
}


async function synthesize(swirl: Swirl, shortenMessage = "", counter = 0): Promise<string> {
  console.log(`counter = ${counter}`);

  if (counter > 5) {
    return ""; 
  }

  const context = "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.";
  const tokenBudget = 3000;
  const outputCharacterLimit = 1024;
  const contextPlusInspiration = `${context} ${shortenMessage} ${swirl.inspiration}`;

  const chunks: string[] = chunkAndCleanResponses(swirl.responses, tokenBudget);

  let synthesisResult = ""; 

  try {
    for (const chunk of chunks) {
      const completionBody: ChatCompletionCreateParamsNonStreaming = {
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
      } else {
        synthesisResult += completionText;
        console.log(`Synthesis result = ${synthesisResult}`);
      }
    }
    console.log(`Final synthesis = ${synthesisResult}`);
    return synthesisResult; 
  } catch (e) {
    console.error(`Error with synthesizing: ${e}`);
    return ""; 
  }
}

function chunkAndCleanResponses(
  responses: { fid: number | undefined; response: string | undefined; }[], 
  maxChunkSize: number, 
): string[] {
  const result: string[] = [];
  let currentChunk: string = "";

  for (const {response} of responses) {
    if (response === undefined) {
      continue;}
    const cleanedResponse: string = response.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim() + ". ";
    
    if (currentChunk.length + cleanedResponse.length > maxChunkSize) {
      result.push(currentChunk);
      currentChunk = cleanedResponse;
    } else {
      currentChunk += cleanedResponse;
    }
  }

  if (currentChunk.length > 0) {
    result.push(currentChunk);
  }

  return result
}



function calculateAverages(
  responses: { fid: number | undefined; response: string | undefined; }[], 
  ratings: { fid: number | undefined; rating: number | undefined; }[]
): { participantAverage: number, totalAverage: number } {
  const validResponses = responses.filter(response => response !== undefined && response.fid !== undefined);
  const validRatings = ratings.filter(rating => rating !== undefined && rating.fid !== undefined && rating.rating !== undefined);

  const totalSum = validRatings.reduce((acc, curr) => acc + (curr.rating ?? 0), 0);
  const totalAverage = validRatings.length > 0 ? totalSum / validRatings.length : 0;

  const participantRatings = validRatings.filter(rating => validResponses.some(response => response.fid === rating.fid));
  const participantSum = participantRatings.reduce((acc, curr) => acc + (curr.rating ?? 0), 0);
  const participantAverage = participantRatings.length > 0 ? participantSum / participantRatings.length : 0;

  return { participantAverage, totalAverage };
}

function renderSwirlWithUniqueColors(swirl: Swirl) {
  // Predefined set of distinct colors
  const colors = [
    '#900C3F', '#FFC300', '#581845', '#4CBB17', '#3333FF',
    '#FD6C9E', '#17A2B8', '#FF5733', '#808000', '#4682B4',
    '#008080', '#6A5ACD', '#800080', '#008000', '#C70039'
  ];
  
  const shuffleArray = (array: string[]): string[] => {
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

  const responsesWithExtras = fullText.split('\n').map((line, index) => (
    <div key={index} style={{ color: shuffledColors[index % shuffledColors.length] }}>
      {line}
    </div>
  ));

  return responsesWithExtras;
}


//// Frog


export const app = new Frog({ 
  basePath: '/swirl',
  browserLocation: 'https://cultureblocks.world',
  hub: neynar({ apiKey: process.env.NEYNAR_API_KEY ?? 'default_api_key' }),
  imageOptions: {
    format: 'png',
  },
  secret: process.env.FROG_SECRET
})





// Middleware
app.use(async (c, next) => {
  console.log(`Middleware [${c.req.method}]`)
  console.log(c.res.headers);
  await next()
})



// Intro Swirl Frame

const images: string[] = [
  "One.jpeg", "Two.jpeg", "Three.jpeg", "Four.jpeg", "Five.jpeg",
  "Six.jpeg", "Seven.jpeg", "Eight.jpeg", "Nine.jpeg", "Ten.jpeg",
  "Eleven.jpeg", "Twelve.jpeg", "Thirteen.jpeg", "Fourteen.jpeg", "Fifteen.jpeg",
  "Sixteen.jpeg", "Seventeen.jpeg", "Eighteen.jpeg", "Nineteen.jpeg", "Twenty.jpeg",
  "TwentyOne.jpeg", "TwentyTwo.jpeg", "TwentyThree.jpeg", "TwentyFour.jpeg", "TwentyFive.jpeg",
  "TwentySix.jpeg", "TwentySeven.jpeg", "TwentyEight.jpeg", "TwentyNine.jpeg", "Thirty.jpeg",
  "ThirtyOne.jpeg", "ThirtyTwo.jpeg", "ThirtyThree.jpeg", "ThirtyFour.jpeg", "ThirtyFive.jpeg"
];

function getRandomImage(): string {
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
      <Button action="/swirl" value="loadSwirl">Swirl</Button>,
      <Button action="/block" value="loadBlock">Block</Button>,
    ],
  });
});


app.frame('/swirl', async (c) => {
  const { buttonValue, buttonIndex, frameData, inputText} = c
  let sanitizedText: string | undefined

  if (inputText !== undefined) {
    sanitizedText = sanitizeText(inputText);
  } else {
    sanitizedText = undefined;
  }
  const swirl = findSwirlDataByCastId(frameData?.castId.hash)

  if (swirl && swirl.currentTurn != 0){ // Swirl exists

    if (swirl.synthesis) { // Synth exists, no more messages

      const swirlContent = renderSwirlWithUniqueColors(swirl);

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          {swirlContent}
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action="/swirl">Swirl</Button>, 
          <Button action="/block">Block</Button>, 
        ],
      })
    } else if (buttonValue === "merge") {// Save response, show swirl, synthesize if all responses are in

      const newResponse = { fid: frameData?.fid, response: sanitizedText };
      
      const index = swirl.responses.findIndex(response => response.fid === newResponse.fid);
      if (index !== -1) {
          swirl.responses[index] = newResponse;
      } else {
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
        image: (
          <div
          style={{
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
          }}
        >
          {swirlContent}
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action="/swirl">Swirl</Button>, 
          <Button action="/block">Block</Button>, 
        ],
      })
    } else if (!swirl.responses.some(response => response.fid === frameData?.fid)){//If fid not in responses, User can respond

      const swirlContent = renderSwirlWithUniqueColors(swirl);

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          {swirlContent}
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <TextInput placeholder="Add some flavor..." />,
          <Button action="/swirl" value="merge">Merge</Button>, 
        ],
      })
    } else {// One message per user 

      const swirlContent = renderSwirlWithUniqueColors(swirl);

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          {swirlContent}
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <TextInput placeholder="One message per person..." />,
          <Button action="/swirl" value="merge">Replace Your Message</Button>, 
          <Button action="/block">Block</Button>, 
        ],
      })
    } 
  } else { // Swirl does not exist 

    if (frameData?.fid === frameData?.castId.fid) {// Creator can create 
      
      if (buttonValue === "loadSwirl"){ // Creator can inspire 

        const text = `Inspiration sets the theme or focal point for responses. \n\n If left blank, who knows what could happen...`
        const inspirationText = text.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ));
        return c.res({
          image: (
            <div style={{ backgroundColor: 'white', width: '100vw', height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div
                style={{
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
                }}
              >
                {inspirationText}
              </div>
            </div>
          ),
          imageOptions: { 
            width: 600, 
            height: 600, 
          },
          intents: [
            <TextInput placeholder="..." />,
            <Button action= "/swirl" value="inspiration">Wow</Button>,
            <Button action= "/swirl" value="inspiration">No</Button>,
          ],
        })
      } else if (buttonValue === "inspiration"){ // Creator can emulsify

        if (buttonIndex === 1 && sanitizedText !== undefined) {
          swirl.inspiration = sanitizedText;
        } else {
          swirl.inspiration = '';
        }
        swirl.castId = frameData?.castId.hash
        swirl.creatorId = frameData?.castId.fid
        saveSwirl(swirl);
      
        const text = `An emulsifier gives AI directions on what to do with the comments.\n\n If left blank, who knows what could happen...`
        const emulsifierText = text.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ));
        
        return c.res({
          image: (
            <div
            style={{
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
            }}
          >
            {emulsifierText}
          </div>
          ),
          imageOptions: { width: 600, height: 600 },
          intents: [
            <TextInput placeholder="..." />,
            <Button action= "/swirl" value="emulsifier">Wow</Button>,
            <Button action= "/swirl" value="emulsifier">No</Button>,
          ],
        })
      } else if (buttonValue === "emulsifier"){ // Creator can confirm X //TESTING
        
        if (buttonIndex === 1 && sanitizedText !== undefined) {
            swirl.emulsifier = sanitizedText;
        } else {
            swirl.emulsifier = '';
        }
        saveSwirl(swirl);

        const text = `Inspiration: ${swirl.inspiration}\nEmulsifier: ${swirl.emulsifier}\n\nDoes this look good?`;
        const confirmText = text.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ));


        return c.res({
          image: (
            <div
            style={{
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
            }}
          >
            { confirmText }
          </div>
          ),
          imageOptions: { width: 600, height: 600, headers: {'Content-Type': 'image/svg+xml'}},
          intents: [
            <Button action= "/swirl" value="confirm">Yes</Button>,
            <Button action= "/swirl" value="loadSwirl">No</Button>,
          ],
        })
      } else { // Save new swirl, serve, accept message -> "merge" 

        swirl.currentTurn +=1
        saveSwirl(swirl)

        const swirlContent = renderSwirlWithUniqueColors(swirl);

        return c.res({
          image: (
            <div
            style={{
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
            }}
          >
            {swirlContent}
          </div>
          ),
          imageOptions: { width: 600, height: 600 },
          intents: [
            <TextInput placeholder="Add some flavor..." />,
            <Button action="/swirl" value="merge">Merge</Button>, 
          ],
        })
      }
    
    } else {// Not creator, wait 
    
      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          The Swirl has not started yet. Check back soon.
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action= "/swirl" value="loadSwirl">Soon</Button>,
          <Button action= "/block">Block</Button>,
        ],
      })
    } 
  } 
})
  



app.frame('/block', async (c) => {
  const { buttonValue, frameData, inputText} = c
  const swirl = findSwirlDataByCastId(frameData?.castId.hash)
  if (swirl.castId){// swirl exists

    if (swirl.synthesis){//synth + mint exist

      if (buttonValue === "rate"){//add a rating if haven't

        if (swirl.ratings.some(rating => rating.fid === frameData?.fid)) {// one rating per user

          return c.res({
            image: (
              <div
                style={{
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
                }}
              >
                  One rating per user.
              </div>
            ),
          imageOptions: { width: 600, height: 600 },
            intents: [
              <Button action="/block" value="stats">Stats</Button>, 
              <Button action="/block">Block</Button>, 
            ],
          })
        } else {//accept rating 
          
          return c.res({
            image: (
              <div
              style={{
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
              }}
              >
              Rate the Block.
            </div>
          ),
          imageOptions: { width: 600, height: 600 },
            intents: [
              <Button action="/block" value="1">1</Button>, 
              <Button action="/block" value="2">2</Button>, 
              <Button action="/block" value="3">3</Button>, 
              <Button action="/block" value="4">4</Button>, 
            ],
          })
        }
      } else if (buttonValue === "stats") {//show stats
        
        const { participantAverage, totalAverage } = calculateAverages(swirl.responses, swirl.ratings);
        const stats = `Participant average rating: ${participantAverage.toFixed(2)}\nTotal average rating: ${totalAverage.toFixed(2)}`;

        const statsLines = stats.split('\n').map((line, index) => (
          <div key={index}>{line}</div>
        ));


        return c.res({ 
          image: (
            <div
              style={{
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
              }}
            >
              {statsLines}
            </div>
          ),
          imageOptions: { width: 600, height: 600 },
          intents: [
            <Button action="/block" value="rate">Rate</Button>, 
            <Button action="/block">Block</Button>,
          ],
        });
        
        
      } else if (buttonValue !== undefined && ["1", "2", "3", "4"].includes(buttonValue)) { // Save rating
        
        const rating: number = parseInt(buttonValue);
        swirl.ratings.push({ fid: frameData?.fid, rating });
        saveSwirl(swirl);

        return c.res({
            image: (
              <div
              style={{
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
              }}
            >
              Your rating has been saved.
            </div>
          ),
          imageOptions: { width: 600, height: 600 },
            intents: [
                <Button action="/swirl">Swirl</Button>,
                <Button action="/block">Block</Button>,
            ],
        });
    
      } else {//show block

        return c.res({
          image: (
            <div
              style={{
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
              }}
            >
              {swirl.synthesis}
            </div>
          ),
          imageOptions: { width: 600, height: 600 },
          intents: [
            <Button action="/swirl">Swirl</Button>, 
            <Button action="/block" value="stats">Stats</Button>, 
            // <Mint>, 
          ],
        })
      }
    } else if (buttonValue==="creatorSynth"){// Synth early

      const synthesis = await synthesize(swirl, "", 0);
      swirl.synthesis = synthesis;
      saveSwirl(swirl);

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          {swirl.synthesis}
        </div>
      ),
      imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action="/swirl">Swirl</Button>, 
          <Button action="/block">Block</Button>, 
        ],
      })
    } else if (frameData?.fid === frameData?.castId.fid){// Creator push synth?

      const turnsLeft = `This swirl has ${swirl.turns - swirl.responses.length} turns left. Would you like to end it now and synthesize the responses? The frame might freeze for a bit while it synthesizes the responses.`

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          {turnsLeft}
        </div>
      ),
      imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action="/block" value="creatorSynth">Yes</Button>, 
          <Button action="/swirl">No</Button>, 
        ],
      })
    } else { // No synth yet.

      return c.res({
        image: (
          <div
          style={{
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
          }}
        >
          The Swirl has not finished. Check back soon.
        </div>
        ),
        imageOptions: { width: 600, height: 600 },
        intents: [
          <Button action="/swirl">Swirl</Button>, 
          <Button action="/block">Block</Button>, 
        ],
      })
    }
  } else {// No swirl yet.

    return c.res({
      image: (
        <div
        style={{
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
        }}
      >
        The Swirl has not started yet. Check back soon.
      </div>
      ),
      imageOptions: { width: 600, height: 600 },
      intents: [
        <Button action="/swirl" value="loadSwirl">Swirl</Button>, 
        <Button action="/block">Block</Button>, 
      ],
    })

  }
})



const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})
