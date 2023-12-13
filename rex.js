const tesseract = require('tesseract.js');
const closestMatch = require('closest-match');
const fs = require('fs');
const jimp = require('jimp');
const colors = require('./ntc');

// nut js

const {mouse, screen, Region, getActiveWindow, getWindows, imageResource, straightTo, Point, Button} = require('@nut-tree/nut-js');
// require("@nut-tree/template-matcher"); 

(async function () {
    // question
    var questions = [];
    var OXJson
    await fs.readFile('resources/oxquiz.json', async function(err, data) {
        OXJson = JSON.parse(data.toString());
        Object.keys(OXJson).forEach(function (question) {
            questions.push(question);
        });
    });

    // initializing tesseract worker
    const worker = await tesseract.createWorker('eng');

    function calculatePosition(windowInfo, pos, type) {
        if (type == 'x') {
            return pos * (windowInfo.width / 960)
        } else {
            return pos * (windowInfo.height / 540)
        }
    }

    async function getWindowInfo(debug = false) {
        var windows = await getWindows();
        for (x = 0; x < windows.length; x++) {
            var window = windows[x];
            var [title, region] = await Promise.all([window.title, window.region]);

            if (debug) {
                if (title != '' && (region.width > 0 && region.height > 0)) {
                    console.log(title);
                }
            }

            if (title == 'ROX' && (region.width > 0 && region.height > 0 && region.left >= 0 && region.top >= 0)) {                
                //return {width: region.width, height: region.height, left: region.left, top: region.top}
                return region;
            }
        }
    }

    async function moveCursor() {
        await mouse.move(straightTo(new Point(200, 100)));
        await mouse.doubleClick(Button.LEFT);
        await mouse.drag(straightTo(new Point(600, 340)));
    }

    async function getQuestion() {
        var windowInfo = await getWindowInfo();

        if (windowInfo) {
            await screen.captureRegion('ss', new Region(133 + windowInfo.left, 163 + windowInfo.top, 681, 87), '.png', '.temp/').then(async function() {
                await asnwerQuestion();
            }).catch((err) => {
                console.log(err);
            })
        } else {
            console.log('window not found');
        }
    }

    async function asnwerQuestion(path = null) {
        /*
        offset:
        width: 681
        height: 87
        left: 133
        top: 163
        */

        const ret = await worker.recognize(path || '.temp/ss.png');
        var question = closestMatch.closestMatch(ret.data.text.split('\n')[0], questions)

        console.log(`Question: ${question}`)
        console.log(OXJson[question]);
        await worker.terminate();
    }

    async function autoGardening() {
        async function clickButton() {
            /*
            offset:
            top: 580 + 18
            left: 238 + 18
            */

            var windowInfo = await getWindowInfo();
            await mouse.move(straightTo(new Point(calculatePosition(windowInfo, 598, 'x') + windowInfo.left, calculatePosition(windowInfo, 250, 'y') + windowInfo.top)));
            await mouse.doubleClick(Button.LEFT);

            await detectCaptcha();

            console.log('gathering ...');
        }

        async function solveCaptcha() {
            /*
            offset:
            top: 458
            left: 291
            height: 20
            width: 42
            */

            var windowInfo = await getWindowInfo();
            await screen.captureRegion('captcha', new Region(calculatePosition(windowInfo, 445, 'x') + windowInfo.left, calculatePosition(windowInfo, 294, 'y') + windowInfo.top, calculatePosition(windowInfo, 74, 'x'), calculatePosition(windowInfo, 18, 'y')), '.png', '.temp/').then(async function() {
                const ret = await worker.recognize('.temp/captcha.png');
                console.log(ret.data.text);

            }).catch(function (err) {
                console.log(err);
            });
        }

        async function detectCaptcha() {
            await screen.captureRegion('ss', await getWindowInfo(), '.png', '.temp/').then(async function() {
                var windowInfo = await getWindowInfo();
                await jimp.read('.temp/ss.png').then(async function (image) {
                    var pixel = image.getPixelColor(calculatePosition(windowInfo, 433, 'x'), calculatePosition(windowInfo, 208, 'y'))
                    var color = pixel.toString()[0];
                    console.log(jimp.intToRGBA(pixel))

                    if (pixel.r > 190 && pixel.g > 190 && pixel.b > 190) {
                        console.log('solving captcha ...');
                        await solveCaptcha();
                    } else {
                        console.log('captcha pass');
                    }
                }).catch(function (err) {
                    console.log(err);
                });
            });
        }

        await clickButton();

        setInterval(async function () {
            await clickButton();
        }, 7000);
    }

    await autoGardening();
})()