import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';

import ytdl from 'youtube-dl-exec';

import ffmpeg from 'ffmpeg';
import child_process from 'child_process';
import util from 'util';


const exec = util.promisify(child_process.exec);



const tealhollow1Id = 52585950;

const debug = false;
const videoEncoder = 'h264';
const input = 'input.mp4';
const output = 'output.mp4';


async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getListOfClipsFromChannel(url, clientId, authorization) {
    return await fetch(url, {
	method: 'GET',
	headers: {
		Authorization: `Bearer ${authorization}`,
		'Client-Id': clientId
	}
    }).then(async res => { return await res.json();})
}

async function getTimeStampsForWeek() {
    let date = new Date();

    let dateUnixFormatToByDayOfWeek = (1000 * 60 * 60 * 24);

    // Week starts and ends on Monday LMAO
    let beginningOfWeek = new Date((Math.trunc(date / dateUnixFormatToByDayOfWeek) - date.getDay() + 1) * dateUnixFormatToByDayOfWeek);
    let endOfWeek = new Date((Math.trunc(date / dateUnixFormatToByDayOfWeek) - date.getDay() + 8) * dateUnixFormatToByDayOfWeek);

    return {start: beginningOfWeek, end: endOfWeek};
}

async function getTimeStampForDayTealTime() {
    let date = new Date();

    let dateUnixFormatToByDayOfWeek = (1000 * 60 * 60 * 24);

    let dateUnixFormatToByPerHour = (1000 * 60 * 60);

    let dayStartTealTime = new Date((Math.trunc(date / dateUnixFormatToByDayOfWeek) * dateUnixFormatToByDayOfWeek) - dateUnixFormatToByPerHour);

    return dayStartTealTime;
}


async function onFrame(frame, frameCount) {
    if (frameCount < 6) {
        frame = new jimp(frame.bitmap.width, frame.bitmap.height, 0xff0000ff, (err, image) => { });
    } else {
        // Add text
        const font = await jimp.loadFont(jimp.FONT_SANS_32_WHITE);
        frame.print(font, 0, 0, `Frame Count: ${frameCount}`);

        // Manuel manipulation
        frame.scan(0, 0, frame.bitmap.width, frame.bitmap.height, function (x, y, idx) {
            // Get the colours
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            // If x is less than y
            if (x < y) {
                // Set the blue channel to 255
                this.bitmap.data[idx + 2] = 255;
            }
        });
    }

    return frame;
}



(async function main() {
    // Get OAuth2 token  for session
    let oauthURL = `https://id.twitch.tv/oauth2/token?client_id=${process.env.TWITCH_APP_CLIENT_ID}&client_secret=${process.env.TWITCH_APP_CLIENT_SECRET}&grant_type=client_credentials`;

    let oauthResponse = await fetch(oauthURL, { method: 'POST' }).then(res => {return res.json()});

    oauthURL = '';


    // Get URL and send request for clips
    let timeStamps = await getTimeStampsForWeek();

    let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${tealhollow1Id}&first=30&started_at=${timeStamps.start.toISOString()}&ended_at=${timeStamps.end.toISOString()}`;

    let clips = await getListOfClipsFromChannel(url, process.env.TWITCH_APP_CLIENT_ID, oauthResponse.access_token);
    console.log(clips.data);


    // Visualization setup
    // let arr = [];

    // for (let i = 0; i < clips.data.length; i++) {
    //     arr.push({index: i, created_at: clips.data[i].created_at});
    // }
    // console.log('Before sort: ', arr);

    // Insertion sort HAHAHA
    for (let i = 1; i < clips.data.length; i++) {
        for (let j = i; j > 0 && Date.parse(clips.data[j].created_at) < Date.parse(clips.data[j - 1].created_at); j--) {
            const tempArr = clips.data[j];
            
            clips.data[j] = clips.data[j - 1];
            
            clips.data[j - 1] = tempArr;
        }
    }

    // Remove clips within small time periods (3 min;  more or less duplicates)
    for (let i = 0; i + 1 < clips.data.length; i++) {
        for (let j = i + 1; j < clips.data.length;) {
            if (Date.parse(clips.data[j].created_at) <= Date.parse(clips.data[i].created_at) + 180000) {
                if (clips.data[j].view_count <= clips.data[i].view_count) {
                    clips.data.splice(j, 1);
                } else {
                    clips.data.splice(i, 1);
                }
            } else {
                break;
            }
        }
    }

    for (let i = 1; i < clips.data.length; i++) {
        for (let j = i; j > 0 && clips.data[j].view_count > clips.data[j - 1].view_count; j--) {
            const tempArr = clips.data[j];
            
            clips.data[j] = clips.data[j - 1];
            
            clips.data[j - 1] = tempArr;
        }
    }

    console.log(clips.data.length);

    // Download clips from list
    for (let i = 0; i < clips.data.length; i++) {
        try {
            await ytdl(clips.data[i].url, {
                output: `clips\\${clips.data[i].id}.%(ext)s`
            }).then(output => console.log(output));
        } catch (err) {
            console.log(err);
        }
    }


    try {
        console.log('Encoding...');

        // I COULDN'T GET THIS TO WORK CORRECTLY!!!
        // await new ffmpeg('./pot_input.mp4').then(async (video) => {
        //     video.addCommand('-y');
        //     video.addCommand('-aspect', '16:9');
        //     video.addCommand('-s', '1920x1080');
        //     video.addFilterComplex('scale=iw*sar:ih, pad=max(iw\\,ih*(16/9)):ow/(16/9):(ow-iw)/2:(oh-ih)/2:#000000');
        //     video.save('./temp/pot_input.mp4');
        // }, async (err) => {
        //     console.log(err);
        // });

        await exec(`ffmpeg -i ./pot_input.mp4 -y -aspect 16:9 -s 1920x1080 -filter_complex "scale=iw*sar:ih, pad=max(iw\\,ih*(16/9)):ow/(16/9):(ow-iw)/2:(oh-ih)/2:#000000" ./temp/pot_input.mp4`);

        // I COULDN'T GET THIS TO WORK CORRECTLY!!!
        // await new ffmpeg('./outro.mp4').then(async (video) => {
        //     video.addCommand('-y');
        //     video.addCommand('-aspect', '16:9');
        //     video.addCommand('-s', '1920x1080');
        //     video.addFilterComplex('scale=iw*sar:ih, pad=max(iw\\,ih*(16/9)):ow/(16/9):(ow-iw)/2:(oh-ih)/2:#000000');
        //     video.save('./temp/outro.mp4');
        // }, async (err) => {
        //     console.log(err);
        // });

        await exec(`ffmpeg -i ./outro.mp4 -y -aspect 16:9 -s 1920x1080 -filter_complex "scale=iw*sar:ih, pad=max(iw\\,ih*(16/9)):ow/(16/9):(ow-iw)/2:(oh-ih)/2:#000000" ./temp/outro.mp4`);

        await new ffmpeg('./temp/pot_input.mp4').then(async (video) => {
            video.addCommand('-y');
            video.addCommand('-vsync', 'vfr');

            let filterComplex = '[0:v][0:a]';

            let i = 1;
            for (; i <= clips.data.length; i++) {
                video.addInput(`./clips/${clips.data[i - 1].id}.mp4`);
                filterComplex = filterComplex.concat(`[${i}:v][${i}:a]`);
            }

            video.addInput('./temp/outro.mp4');
            filterComplex = filterComplex.concat(`[${i}:v][${i}:a]`);

            video.addFilterComplex(`${filterComplex}concat=n=${i + 1}:v=1:a=1`);

            video.save('./output.mp4');
        }, async (err) => {
            console.log(err);
        });

    } catch (err) {
        console.log(err);
    }


    // Get most popular of sent list of clips
    // let theClip = {view_count: 0, id: null}
    // clips.data.forEach(item => {
    //     if (item.view_count > theClip.view_count) {
    //         theClip = item;
    //     }
    // });

    // if (theClip.id === null) {
    //     console.log('Could not find clip :(');
    // } else {
    //     console.log(theClip);
    // }
})();

