const puppeteer = require('puppeteer');
const URL = require('url').URL;
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


(async () => {
    LOGIN_NAME = process.env.LOGIN_NAME
    PASSWORD = process.env.PASSWORD
    COLUMN_ID = parseInt(process.argv[2], 10)
    if (isNaN(COLUMN_ID)) {
        COLUMN_ID = 0
    }
    console.log(LOGIN_NAME, PASSWORD, COLUMN_ID)
    // process.exit(0)
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
    main_page = await page.goto('https://account.geekbang.org/signin?redirect=https%3A%2F%2Ftime.geekbang.org%2Fcolumns');
    const warnning_dialog_confirm_button = await page.$('body > div.confirm-box-wrapper > div.confirm-box > div.foot > a')
    if (warnning_dialog_confirm_button != null) {
        warnning_dialog_confirm_button.click()
    }
    await page.type('body > div > div.container > div.card > div.nw-phone-container > div.nw-phone-wrap > input', LOGIN_NAME)
    await page.type('body > div > div.container > div.card > div.input-wrap > input', PASSWORD)
    const login_button_selector = 'body > div > div.container > div.card > button'
    await page.waitForSelector(login_button_selector)
    await page.click(login_button_selector)

    // page.screenshot({ path: 'login.png' })

    const columns_dict = {}
    const columns = []
    const columns_articles_dict = {}

    // await page.setRequestInterception(true);
    page.on('requestfinished', async res => {
        if (res.resourceType() === 'xhr') {
            // console.log(res.url())
            const parsedUrl = new URL(res.url())
            if (parsedUrl.pathname === '/serv/v1/columns') {
                const resp = await res.response().json()
                resp.data.list.forEach(column => {
                    if (column.had_sub) {
                        // const url = 'https://time.geekbang.org/column/intro/' + id
                        if (COLUMN_ID === 0 || COLUMN_ID === column.id) {
                            columns_dict[column.id] = column
                            columns.push(column.id)
                        }
                    }
                });
            }

            if (parsedUrl.pathname === '/serv/v1/column/articles') {
                const post_data = JSON.parse(res.postData())
                const resp = await res.response().json()
                const articles = []
                const cid = post_data.cid
                resp.data.list.forEach(article => {
                    const id = article.id
                    // console.log(id)
                    articles.push(article)
                });
                columns_articles_dict[cid] = articles
            }

            if (parsedUrl.pathname === '/serv/v1/article') {
                const resp = await res.response().json()
                cid = resp.data.cid
                id = resp.data.id
            }
        }
    })

    await page.waitForNavigation()
    await page.waitForSelector('#app > div > div.columns-list > div:nth-child(1)')
    // await page.screenshot({ path: 'geekbang-columns.png' });

    // console.log(columns)
    for (let i = 0; i < columns.length; i++) {
        column = columns_dict[columns[i]]
        // console.log(column.column_title)
        const url = 'https://time.geekbang.org/column/intro/' + column.id
        await page.goto(url)
        await page.waitForSelector('#app > div > div.column-main > div.course-tab-view > div:nth-child(1) > div > div.table-item-text > div')
        // await page.screenshot({ path: 'geekbang-column.png' });
        // break
    }

    for (let i = 0; i < columns.length; i++) {
        column_title = columns_dict[columns[i]].column_title;
        column_title = column_title.replace(/[/\\\?%*:\|"<>\.& ]/g, '');
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

        for (let i = 0; i < articles.length; i++) {
            const url = 'https://time.geekbang.org/column/article/' + articles[i].id
            console.log(url)
            // await page.goto(url);
            // await page.goto(url, { "waitUntil": "networkidle2" });
            await page.goto(url, { "waitUntil": "networkidle0" });
            await page.waitForSelector('#app > div > div > div.article-content.typo.common-content > p')
            title = await page.$eval('#app > div > div > h1', title => title.innerText)
            title = title.replace(/[/\\\?%*:\|"<>\.& ]/g, '-');
            title = i.toString() + '-' + title
            console.log(title)
            pdf_file_path = path.join(column_path, title + '.pdf')
            await page.pdf({ path: pdf_file_path });

            try {
                const audio_url = await page.$eval('#app > div > div > div.article-content.typo.common-content > div.mini-audio-player > audio', audio => audio.src)
                // console.log(audio_url)
                audio_file_path = path.join(column_path, title + '.mp3')
                const cmd = 'C:\\gohls\\gohls.exe -l=true ' + audio_url + ' ' + audio_file_path
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