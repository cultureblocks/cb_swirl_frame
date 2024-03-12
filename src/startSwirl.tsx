import { Button, Frog, TextInput} from 'frog'

 
export const app = new Frog({
    browserLocation:'http://cultureblocks.world/swirl',
    initialState: {
        castId: 0,
        creator: "",
        headline: "",
        emulsifier: "",
        current_turn: 0,
        turns: 6,
        responses: {
            //username : message
        },
        synthesis: ""
    }
})
 
app.frame('/', (c) => {
  const { buttonValue, status } = c
  return c.res({
    image: (
      <div style={{ color: 'white', display: 'flex', fontSize: 60 }}>
        {status === 'initial' ? (
          'Select your fruit!'
        ) : (
          `Selected: ${buttonValue}`
        )}
      </div>
    ),
    intents: [
      <Button value="apple">Apple</Button>,
      <Button value="banana">Banana</Button>,
      <Button value="mango">Mango</Button>
    ]
  })
})