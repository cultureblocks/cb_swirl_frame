// Bot needs to cast a frame to the cb channel, nothing else...
import { NeynarAPIClient, isApiErrorResponse, CastParamType } from "@neynar/nodejs-sdk";
import dotenv from 'dotenv';
dotenv.config();
const signerUuid = process.env.SIGNER_UUID;
const neynarClient = new NeynarAPIClient(process.env.NEYNAR_API_KEY ?? 'default_api_key');
if (!signerUuid) {
    throw new Error("SIGNER_UUID is not defined");
}
if (!neynarClient) {
    throw new Error("NEYNAR_API_KEY is not defined");
}
const checkCbChannel = async (castHash) => {
    try {
        const castData = await neynarClient.lookUpCastByHashOrWarpcastUrl(castHash, CastParamType.Hash);
        console.log("cast data is:", castData);
        if (castData.cast.parent_url === "https://warpcast.com/~/channel/culture-blocks") {
            return true;
        }
        else {
            return false;
        }
    }
    catch (err) {
        // Error handling, checking if it's an API response error.
        if (isApiErrorResponse(err)) {
            console.log(err.response.data);
        }
        else {
            console.log(err);
        }
        return false;
    }
};
const options = {
    embeds: [
        {
            url: "https://cultureblocks.space/swirl"
        }
    ],
    channelId: "culture-blocks"
};
const cbCast = async (msg) => {
    try {
        // Using the neynarClient to publish the cast.
        const response = await neynarClient.publishCast(signerUuid, msg, options);
        console.log("Cast published successfully", response);
        return response.hash;
    }
    catch (err) {
        // Error handling, checking if it's an API response error.
        if (isApiErrorResponse(err)) {
            console.log(err.response.data);
        }
        else {
            console.log(err);
        }
        return undefined;
    }
};
export { checkCbChannel, cbCast };
