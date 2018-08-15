const puppeteer = require('puppeteer');
const URL = require('url').URL;
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


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
        executablePath: 'C:\\chrome-win32\\chrome.exe'
    }
    const browser = await puppeteer.launch(options);
    const page = await browser.newPage();
    page.setViewport({
        height: 1080,
        width: 1920
    })
    main_page = await page.goto('https://account.geekbang.org/signin?redirect=https%3A%2F%2Ftime.geekbang.org%2Fpaid-content');
    const warnning_dialog_confirm_button = await page.$('body > div.confirm-box-wrapper > div.confirm-box > div.foot > a')
    if (warnning_dialog_confirm_button != null) {
        warnning_dialog_confirm_button.click()
    }
    await page.type('body > div > div.container > div.card > div.nw-phone-container > div.nw-phone-wrap > input', LOGIN_NAME)
    await page.type('body > div > div.container > div.card > div.input-wrap > input', PASSWORD)
    const login_button_selector = 'body > div > div.container > div.card > button'
    await page.waitForSelector(login_button_selector)
    await page.click(login_button_selector)

    const columns_dict = {}
    const columns = []
    const columns_articles_dict = {}

    // await page.setRequestInterception(true);
    page.on('requestfinished', async res => {
        if (res.resourceType() === 'xhr') {
            // console.log(res.url())
            const parsedUrl = new URL(res.url())
            if (parsedUrl.pathname === '/serv/v1/column/all') {
                const resp = await res.response().json()
                resp.data['3'].list.forEach(column => {
                    if (column.had_sub) {
                        if (COURSE_ID === 0 || COURSE_ID === column.id) {
                            columns_dict[column.id] = column
                            columns.push(column.id)
                        }
                    }
                });
            }

            if (parsedUrl.pathname === '/serv/v1/column/intro') {
                const resp = await res.response().json()
                const video_url = JSON.parse(resp.data.column_video_media).hd.url
                columns_dict[resp.data.id]['column_video_url'] = video_url
            }
        }
    })

    await page.waitForNavigation()
    await page.waitForSelector('#app > div > div.content-wrap > div:nth-child(4) > div:nth-child(1)')

    // console.log(columns)
    for (let i = 0; i < columns.length; i++) {
        column = columns_dict[columns[i]]
        const url = 'https://time.geekbang.org/course/intro/' + column.id;
        await page.goto(url);
        const resp = await page.waitForResponse('https://time.geekbang.org/serv/v1/column/articles');
        // console.log(resp)
        const post_data = JSON.parse(resp.request().postData())
        const data = await resp.json()
        const cid = post_data.cid
        columns_articles_dict[cid] = data.data.list
    }

    // console.log(columns_articles_dict)
    for (let i = 0; i < columns.length; i++) {
        column_title = columns_dict[columns[i]].column_title
        column_title = column_title.replace(/[/\\\?%*:\|"<>\.& ]/g, '');
        console.log(column_title)
        articles = columns_articles_dict[columns[i]]

        if (!fs.existsSync(column_title)) {
            fs.mkdirSync(column_title)
        }

        video_url = columns_dict[columns[i]].column_video_url
        video_file_path = path.join(column_title, '00---课程介绍' + '.mp4')
        const cmd = 'C:\\gohls\\gohls.exe -l=true ' + video_url + ' ' + video_file_path
        console.log(cmd)
        child_process.execSync(cmd)

        // console.log(articles)
        for (let i = 0; i < articles.length; i++) {
            title = articles[i].article_title
            title = title.replace(/[/\\\?%*:\|"<>\.& ]/g, '-');
            console.log(title)
            try {
                video_url = articles[i].video_media_map.hd.url
                video_file_path = path.join(column_title, title + '.mp4')
                const cmd = 'C:\\gohls\\gohls.exe -l=true ' + video_url + ' ' + video_file_path
                console.log(cmd)
                child_process.execSync(cmd)
            } catch (error) {
                console.log('no audio')
            }
        }
        // break
    }

    await browser.close();
})();