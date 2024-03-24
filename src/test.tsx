import { serve } from '@hono/node-server';
import { Button, Frog } from 'frog';
// import dotenv from 'dotenv';
// import { neynar } from 'frog/hubs'

// dotenv.config();

//// Frog

export const app = new Frog({ 
  basePath: '/swirl',
  // hub: neynar({ apiKey: process.env.NEYNAR_API_KEY ?? 'default_api_key' }),
})

app.frame('/', async (c) => { 
  return c.res({
    image: 'https://via.placeholder.com/150', 
    intents: [
      <Button action="/next" value="frameTwo">Next</Button>,
    ],
  });
});

app.frame('/next', async (c) => {
  const { buttonValue } = c
  if (buttonValue === "frameTwo"){  

    return c.res({
      image: 'https://via.placeholder.com/150',
      intents: [
        <Button action= "/next" value="frameThree">Next</Button>,
      ],
    })
  } 
  else { 
    const text = `Text`
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
        {text}
      </div>
      ),
      intents: [
        <Button action= "/next" value="done">Done</Button>,
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
