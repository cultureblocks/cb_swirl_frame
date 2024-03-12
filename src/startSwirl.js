import { jsx as _jsx } from "hono/jsx/jsx-runtime";
import { Button, Frog } from 'frog';
export const app = new Frog({
    browserLocation: 'http://cultureblocks.world/swirl',
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
});
app.frame('/', (c) => {
    const { buttonValue, status } = c;
    return c.res({
        image: (_jsx("div", { style: { color: 'white', display: 'flex', fontSize: 60 }, children: status === 'initial' ? ('Select your fruit!') : (`Selected: ${buttonValue}`) })),
        intents: [
            _jsx(Button, { value: "apple", children: "Apple" }),
            _jsx(Button, { value: "banana", children: "Banana" }),
            _jsx(Button, { value: "mango", children: "Mango" })
        ]
    });
});
