// // ./app/frames/route.tsx
// /* eslint-disable react/jsx-key */
// import { createFrames, Button } from "frames.js/next";
 
// const frames = createFrames();
// const handleRequest = frames(async (ctx) => {
//   return {
//     image: (
//       <span>
//         {ctx.pressedButton
//           ? `I clicked ${ctx.searchParams.value}`
//           : `Click some button`}
//       </span>
//     ),
//     buttons: [
//       <Button action="post" target={{ query: { value: "Yes" }}}>
//         Say Yes
//       </Button>,
//       <Button action="post" target={{ query: { value: "No" }}}>
//         Say No
//       </Button>,
//     ],
//   };
// });
 
// export const GET = handleRequest;
// export const POST = handleRequest;


import { serve } from '@hono/node-server';
import { Button, Frog } from 'frog';

export const app = new Frog({ 
  basePath: '/swirl'
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
