// tesseract
const tesseract = require('tesseract.js');

// utility
const fs = require('fs');
const prompt = require('prompt-sync')()

// image manipulation gallery
const jimp = require('jimp');
const replaceColor = require('replace-color');

// calculation library
const closestMatch = require('closest-match');

// colors
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
        /*
        if (type == 'x') {
            return pos * (windowInfo.width / 960)
        } else {
            return pos * (windowInfo.height / 540)
        }
        */

        return pos
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

        return new Region(0, 0, 0, 0);
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
            await screen.captureRegion('captcha', new Region(calculatePosition(windowInfo, 445, 'x') + windowInfo.left, calculatePosition(windowInfo, 295, 'y') + windowInfo.top, calculatePosition(windowInfo, 74, 'x'), calculatePosition(windowInfo, 32, 'y')), '.png', '.temp/').then(async function() {
                await jimp.read('.temp/captcha.png').then(async function(image) {
                    console.log('readed')
                    image.scale(5, 5).write('.temp/captcha-resized.png', async function() {
                        console.log('resized')
                        await replaceColor({
                            image: '.temp/captcha-resized.png',
                            colors: {
                                type: 'hex',
                                targetColor: '#7f7f80',
                                replaceColor: '#000000'
                            },
                            deltaE: 10
                        }).then(async function (image) {
                            image.write('.temp/captcha-resized.png', async function(err) {
                                await replaceColor({
                                    image: '.temp/captcha-resized.png',
                                    colors: {
                                        type: 'hex',
                                        targetColor: '#fafafa',
                                        replaceColor: '#000000'
                                    },
                                    deltaE: 4.2
                                }).then(async function (image) {
                                    console.log('shaped')
                                    image.scale(10, 10).write('.temp/captcha-resized.png', async function(err) {
                                        console.log('solving')
                                        if (err) return console.log(err);
                    
                                        var ret = await worker.recognize('.temp/captcha-resized.png');
                                        console.log(ret.data.text.replaceAll('=', '-'));
                                    })
                                }).catch((err) => {
                                    console.log(err)
                                })
                            })
                        })
                    })
                })
            }).catch(function (err) {
                console.log(err);
            });

            /*
            await jimp.read('.temp/captcha-example.png').then(async function(image) {
                image.resize(325, 100).write('.temp/captcha-resized.png', async function() {
                    var ret = await worker.recognize('.temp/captcha-example.png');
                    console.log(ret.data.text);

                    ret = await worker.recognize('.temp/captcha-resized.png');
                    console.log(ret.data.text);
                })
            })
            */
        }

        async function detectCaptcha() {
            await screen.captureRegion('ss', await getWindowInfo(), '.png', '.temp/').then(async function() {
                var windowInfo = await getWindowInfo();
                await jimp.read('.temp/ss.png').then(async function (image) {
                    var pixel = image.getPixelColor(calculatePosition(windowInfo, 598, 'x') + windowInfo.left, calculatePosition(windowInfo, 250, 'y') + windowInfo.top)
                    var color = pixel.toString()[0];
                    console.log(jimp.intToRGBA(pixel));
                    console.log(color);

                    //if (pixel.r > 170 && pixel.g > 170 && pixel.b > 170) {
                    if (color == '3') {
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

        /*
        await solveCaptcha();
        */
    }

    async function autoFishing() {
        async function clickButton() {
            var windowInfo = await getWindowInfo();
            await mouse.move(straightTo(new Point(calculatePosition(windowInfo, 598, 'x') + windowInfo.left, calculatePosition(windowInfo, 250, 'y') + windowInfo.top)));
            await mouse.doubleClick(Button.LEFT);
        }

        async function scanPixel() {
            var windowInfo = await getWindowInfo();
            await screen.captureRegion('fish', new Region(windowInfo.left + 1137, windowInfo.top + 560, 150, 150), '.png', '.temp/').then(async function() {
                await jimp.read('.temp/fish.png').then(async function (image) {
                    var pixel = image.getPixelColor(75, 5);
                    var rgba = jimp.intToRGBA(pixel);

                    console.log(rgba);

                    if (rgba.g > 190) {
                        console.log('maybe green')
                    }
                }).catch(function (err) {
                    console.log(err);
                });
            });
        }

        scanPixel();
        setInterval(async function () {
            await scanPixel();
        }, 500);
    }

    async function displayPrompt() {
        var input = prompt('> ');

        switch (input) {
            case 'g':
                await autoGardening();
                break;

            case 'w':
                console.log(await getWindowInfo());
                break;

            case 'x':
                console.log('exit');
                break;

            default:
                displayPrompt();
                break;
        }
    }


    displayPrompt();
})()