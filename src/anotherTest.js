// Import necessary modules
const express = require('express');

// Create an Express application
const app = express();

// Custom middleware function to log incoming requests
app.use((req, res, next) => {
    console.log('Incoming request:', req.method, req.url);    

    console.log('Request headers:', req.headers);
    
    if (req.body) {
        console.log('Request body:', req.body);
    }

    if (req.query) {
        console.log('Query parameters:', req.query);
    }

    next();
});

// Define route for the webpage
app.get('/swirl', (req, res) => {
    // Set content type to HTML
    res.setHeader('Content-Type', 'text/html');


    // Define your meta tags
    const metaData = `
        <meta property="og:title" content="Swirl">
        <meta property="og:image" content="https://cdn.charmverse.io/user-content/915a386b-4518-414a-b5bd-61124491d40f/03818844-bcea-483b-8e81-92daaafe27e2/Screenshot-2023-10-02-173400.png">
        
        <meta name="fc:frame" content="vNext">
        <meta name="fc:frame:image" content="https://cdn.charmverse.io/user-content/915a386b-4518-414a-b5bd-61124491d40f/03818844-bcea-483b-8e81-92daaafe27e2/Screenshot-2023-10-02-173400.png">
        <meta name="fc:frame:image:aspect_ratio" content="1:1">
        
        <meta name="fc:frame:button:1" content="Send">
        <meta name="fc:frame:button:1:action" content="post">
        <meta name="fc:frame:button:1:target" content="http://cultureblocks.world/swirl">
        
        <meta name="fc:frame:input:text" content="What's cool about your culture?">

    `;
    // Write HTML response with Open Graph meta tags
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <title>Redirecting...</title>
            ${metaData}
        </head>
        <body>
            <script>
                window.location.href = 'https://app.charmverse.io/culture-blocks/farcaster-frame-015000585604306171';
            </script>
        </body>
        </html>
    `);
});

// Route to handle POST requests
app.post('/swirl', (req, res) => {
    // Handle the POST request here
    console.log('Received POST request:', req.body);
    
    // Respond with a success message
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta property="og:title" content="Your Title Here">
            <meta property="og:image" content="https://cdn.charmverse.io/user-content/915a386b-4518-414a-b5bd-61124491d40f/03818844-bcea-483b-8e81-92daaafe27e2/Screenshot-2023-10-02-173400.png">
            
            <meta name="fc:frame" content="vNext">
            <meta name="fc:frame:image" content="https://cdn.charmverse.io/user-content/915a386b-4518-414a-b5bd-61124491d40f/03818844-bcea-483b-8e81-92daaafe27e2/Screenshot-2023-10-02-173400.png">
            <meta name="fc:frame:image:aspect_ratio" content="1:1">
            
            <meta name="fc:frame:button:1" content="Thanks">
            <meta name="fc:frame:button:1:action" content="post">
            <meta name="fc:frame:button:1:target" content="https://app.charmverse.io/culture-blocks/farcaster-frame-015000585604306171">
            
        </head>
        </html>
    `);
});

// Start the server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
