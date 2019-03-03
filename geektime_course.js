const puppeteer = require('puppeteer-extra');
const URL = require('url').URL;
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


const pluginStealth = require("puppeteer-extra-plugin-stealth");
puppeteer.use(pluginStealth());

const CHROME_PATH = 'C:\\chrome-win32\\chrome.exe';
const GOHLS_PATH = 'C:\\gohls\\gohls.exe -l=true ';
const VIDEO_ERROR_SIZE = 1024*1024;

(async () => {
    LOGIN_NAME = process.env.LOGIN_NAME
    PASSWORD = process.env.PASSWORD
    COURSE_ID = parseInt(process.argv[2], 10)
    if (isNaN(COURSE_ID)) {
        COURSE_ID = 0
    }
    console.log(LOGIN_NAME, PASSWORD, COURSE_ID)
    options = {
        // headless: false,
        executablePath: CHROME_PATH
    }
    const browser = await puppeteer.launch(options)
    const page = await browser.newPage()
    page.setViewport({
        height: 1080,
        width: 1920
    })
    main_page = await page.goto(
        'https://account.geekbang.org/signin?redirect=https%3A%2F%2Ftime.geekbang.org%2f%3fcategory%3d3'
    )
    const warning_dialog_confirm_button = await page.$(
        'body > div:nth-child(12) > div.confirm-box > div.foot > a'
    )
    if (warning_dialog_confirm_button != null) {
        warning_dialog_confirm_button.click()
    }

    // await page.screenshot({ path: 'login-pre.png' })
    const switch_password_login_button_selector = 'body > div.clearfix > div.container > div.card > div.forget > a'
    await page.waitForSelector(switch_password_login_button_selector)
    await page.click(switch_password_login_button_selector)

    const login_name_selector = 'body > div.clearfix > div.container > div.card > div.nw-phone-container > div.nw-phone-wrap > input'
    const password_selector = 'body > div.clearfix > div.container > div.card > div.input-wrap > input'
    const login_button_selector = 'body > div.clearfix > div.container > div.card > button'
    await page.waitForSelector(password_selector)
    // await page.screenshot({ path: 'login-switch.png' })
    await page.type(login_name_selector, LOGIN_NAME)
    await page.type(password_selector, PASSWORD)
    await page.click(login_button_selector)

    // await page.screenshot({ path: 'login.png' })
    // process.exit(0)

    const columns_dict = {}
    const columns = []
    const columns_articles_dict = {}

    // await page.setRequestInterception(true);
    page.on('requestfinished', async res => {
        if (res.resourceType() === 'xhr') {
            // console.log(res.url())
            const parsedUrl = new URL(res.url())
            if (parsedUrl.pathname === '/serv/v1/column/newAll') {
                const resp = await res.response().json()
                resp.data.list.forEach(column => {
                    if (column.had_sub) {
                        if (COURSE_ID === 0 || COURSE_ID === column.id) {
                            columns_dict[column.id] = column
                            columns.push(column.id)
                        }
                    }
                })
            }

            if (parsedUrl.pathname === '/serv/v1/column/intro') {
                const resp = await res.response().json()
                const video_url = JSON.parse(resp.data.column_video_media).hd.url
                columns_dict[resp.data.id]['column_video_url'] = video_url
                columns_dict[resp.data.id]['column_title'] = resp.data.column_title
            }
        }
    })

    await page.waitForNavigation()
    await page.waitForSelector('#app > div.page-home > div.content > ul > li:nth-child(1)')


    for (let i = 0; i < columns.length; i++) {
        column = columns_dict[columns[i]]
        const url = 'https://time.geekbang.org/course/intro/' + column.id
        await page.goto(url)
        const resp = await page.waitForResponse(
            'https://time.geekbang.org/serv/v1/column/articles'
        )

        const post_data = JSON.parse(resp.request().postData())
        const data = await resp.json()
        const cid = post_data.cid
        columns_articles_dict[cid] = data.data.list
    }


    for (let i = 0; i < columns.length; i++) {
        column_title = columns_dict[columns[i]].column_title
        column_title = column_title.replace(/[/\\\?%*:\|"<>\.& ]/g, '')
        title = i.toString() + '-' + column_title
        console.log(column_title)
        articles = columns_articles_dict[columns[i]]

        data_path = 'data'
        if (!fs.existsSync(data_path)) {
            fs.mkdirSync(data_path)
        }

        column_path = path.join(data_path, column_title)
        if (!fs.existsSync(column_path)) {
            fs.mkdirSync(column_path)
        }

        video_url = columns_dict[columns[i]].column_video_url
        video_file_path = path.join(column_path, '00---课程介绍' + '.mp4')
        const cmd = GOHLS_PATH + video_url + ' ' + video_file_path
        console.log(cmd)
        child_process.execSync(cmd, { stdio: 'ignore' });

        for (let i = 0; i < articles.length; i++) {
            title = articles[i].article_title
            title = title.replace(/[/\\\?%*:\|"<>\.& ]/g, '-')
            console.log(title)
            const max_retry = 3
            for (let n = 0; n < max_retry; n++) {
                try {
                    video_url = articles[i].video_media_map.hd.url
                    video_size = articles[i].video_media_map.hd.size
                    video_file_path = path.join(column_path, title + '.mp4')
                    const cmd = GOHLS_PATH + video_url + ' ' + video_file_path
                    console.log(cmd)
                    child_process.execSync(cmd, { stdio: 'ignore' })
                    const file_size = fs.statSync(video_file_path).size
                    const delta = Math.abs(file_size - video_size)
                    if (delta < VIDEO_ERROR_SIZE) {
                        break
                    }
                } catch (error) {
                    console.log('no video');
                }
            }
        }
    }
    await browser.close()
})()