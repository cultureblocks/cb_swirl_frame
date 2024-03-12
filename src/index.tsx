import { serve } from '@hono/node-server'
import { Button, Frog, TextInput} from 'frog'
import fetch from 'node-fetch';
import fs from 'fs';

// // Define the type for the data object
// interface SwirlData {
//   castId: string;
//   creatorId: number;
//   creatorName: string;
//   headline: string;
//   emulsifier: string;
//   current_turn: number;
//   turns: number;
//   // responses: [{
//   //     name: string;
//   //     message: string
//   // }];
//   // synthesis: string;
//   // mintLink: string
// }

// // Function to write data to a JSON file
// function saveSwirl(filename: string, data: SwirlData): void {
//     fs.writeFile(filename, JSON.stringify(data, null, 2), (err) => {
//         if (err) {
//             console.error('Error writing to JSON file:', err);
//         } else {
//             console.log('Data written to JSON file successfully.');
//         }
//     });
// }

// // Function to read data from a JSON file
// function loadSwirl(filename: string): SwirlData | null {
//     try {
//         const data: string = fs.readFileSync(filename, 'utf8');
//         return JSON.parse(data) as SwirlData;
//     } catch (err) {
//         console.error('Error reading from JSON file:', err);
//         return null;
//     }
// }

// // Example usage
// const filename: string = 'swirlData.json';

// // Write data to the JSON file
// const dataToWrite: SwirlData = { name: 'John', age: 30, city: 'New York' };
// saveSwirl(filename, dataToWrite);

// // Read data from the JSON file
// const dataRead: SwirlData | null = loadSwirl(filename);
// console.log('Data read from JSON file:', dataRead);


type TransferData = {
    transfers?: [
      {
        username?: string;
    }
  ]
}

// Function to fetch transfer details and extract the username
const getFname = async (fid: number) => {
    console.log("getFname")
    console.log(fid)
    if (fid === 0) {
      return ""; 
    }
    const url = `https://fnames.farcaster.xyz/transfers?fid=${fid}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const transferData = await response.json() as TransferData;
        console.log(transferData.transfers?.[0]?.username)
        console.log("tacos are delicious")
        const username = transferData?.transfers?.[0]?.username; 
        if (!username) {
            throw new Error('Username not found in transfer data');
        }
        return username;
    } catch (error) {
        console.error('Error fetching transfer data:', error);
        return "";
    }
}

export const app = new Frog({
  basePath: '/swirl',
  browserLocation: 'http://cultureblocks.world',
  initialState: {
    castId: "",
    creatorId: 0,
    creatorName: "",
    headline: "",
    emulsifier: "",
    current_turn: 0,
    turns: 6,
    responses: [{
      name: "",
      message: ""
    }],
    synthesis: "",
    mintLink: ""
  },
  // verify: false
  // Supply a Hub API URL to enable frame verification.
  // hubApiUrl: 'https://api.hub.wevm.dev',
})


app.frame('/', async (c) => {
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: `url('https://i.ibb.co/xhNRrSL/swirl-frame-compressed-compressed-compressed.jpg')`, //TODO create url and pull image from /images
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
            A Swirl is a loosely structured conversation that gets converted by AI into a Culture Block.
        </div>
      </div>
    ),
    intents: [
      <Button action="/creator" value="create">Create a Swirl</Button>
    ],
  })
})

app.frame('/creator', async (c) => {
  const { frameData, deriveState } = c  
  const state = await deriveState(async (previousState) => {
    if (frameData?.fid && !previousState.creatorName) {
        previousState.castId = frameData?.castId.hash;
        previousState.creatorId = frameData?.fid; 
        previousState.creatorName = await getFname(previousState.creatorId);
  }
  });
  const dynamicText = `Swirl Creator: ${state.creatorName} \n\n A headline is the seed and source of inspiration for the conversation. (Eg. "Strange experiences", "Food is delicious", "What are you building?").`
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: `url('https://i.ibb.co/xhNRrSL/swirl-frame-compressed-compressed-compressed.jpg')`, //TODO create url and pull image from /images
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {dynamicText}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter your headline..." />,
      <Button action="/headline" value="headline">Submit</Button>,
      <Button.Reset>Reset</Button.Reset>
    ],
  })
})

app.frame('/headline', async (c) => {
  const { buttonValue, inputText, deriveState } = c  
  const state = await deriveState(async (previousState) => {
    if (buttonValue === 'headline' && inputText) {
      previousState.headline = inputText; 
  }//TODO create a try again frame with go back/reset buttons
  });

  const dynamicText=`Swirl Creator: ${state.creatorName} \nHeadline: ${state.headline}\n\n An emulsifier tells the AI how to synthesize the conversation. (Eg. "Write a short story/poem", "Create a novel recipe", "Form a proposal for a web3 project")`
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: `url('https://i.ibb.co/xhNRrSL/swirl-frame-compressed-compressed-compressed.jpg')`, //TODO create url and pull image from /images
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {dynamicText}
        </div>
      </div>
    ),
    intents: [
      <TextInput placeholder="Enter your emulsifier..." />,
      <Button action= "/emulsifier" value="emulsifier">Submit</Button>,
      <Button.Reset>Reset</Button.Reset>
    ],
  })
})
app.frame('/emulsifier', async (c) => {
  const { buttonValue, inputText, deriveState } = c  
  const state = await deriveState(async (previousState) => {
    if (buttonValue === 'emulsifier' && inputText) {
      previousState.emulsifier = inputText; 
  }
  });
  
  const dynamicText = `Everything look good?\n\nSwirl Creator: ${state.creatorName} \nHeadline: ${state.headline}\nEmulsifier: ${state.emulsifier}`
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: `url('https://i.ibb.co/xhNRrSL/swirl-frame-compressed-compressed-compressed.jpg')`, //TODO create url and pull image from /images
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {dynamicText}
        </div>
      </div>
    ),
    intents: [
      <Button action="/startSwirl" value="start">Start Swirl</Button>
    ],
  })
})


app.frame('/startSwirl', async (c) => {
  const { buttonValue, inputText, deriveState } = c  
  const state = await deriveState(async (previousState) => {
    // const dataToWrite: SwirlData = { 
    //   castId: previousState.castId, 
    //   creatorId: previousState.creatorId, 
    //   creatorName: previousState.creatorName,
    //   headline: previousState.headline,
    //   emulsifier: previousState.emulsifier,
    //   current_turn: 0,
    //   turns: 6,
    //   // responses:[
    //   //   {
    //   //     name:previousState.creatorName,
    //   //     message:
    //   //   }
    //   // ] 
    //   };
    // saveSwirl(filename, dataToWrite);
  });
  
  const dynamicText = `Everything look good?\n\nSwirl Creator: ${state.creatorName} \nHeadline: ${state.headline}\nEmulsifier: ${state.emulsifier}`
  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: `url('https://i.ibb.co/xhNRrSL/swirl-frame-compressed-compressed-compressed.jpg')`, //TODO create url and pull image from /images
          backgroundSize: '100% 100%',
          display: 'flex',
          flexDirection: 'column',
          flexWrap: 'nowrap',
          height: '100%',
          justifyContent: 'center',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'black',
            fontSize: 60,
            fontStyle: 'normal',
            letterSpacing: '-0.025em',
            lineHeight: 1.4,
            marginTop: 30,
            padding: '0 120px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {dynamicText}
        </div>
      </div>
    ),
    intents: [
      <Button action="/startSwirl" value="start">Start Swirl</Button>
    ],
  })
})


const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})
