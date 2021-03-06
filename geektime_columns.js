const puppeteer = require("puppeteer-extra");
const URL = require('url').URL;
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');


const pluginStealth = require("puppeteer-extra-plugin-stealth");
puppeteer.use(pluginStealth());

const CHROME_PATH = 'C:\\chrome-win32\\chrome.exe';
const GOHLS_PATH = 'C:\\gohls\\gohls.exe -l=true ';

(async () => {
    LOGIN_NAME = process.env.LOGIN_NAME
    PASSWORD = process.env.PASSWORD
    COLUMN_ID = parseInt(process.argv[2], 10)
    if (isNaN(COLUMN_ID)) {
        COLUMN_ID = 0
    }
    console.log(LOGIN_NAME, PASSWORD, COLUMN_ID)
    // process.exit(0)
    const width = 859
    const height = 1080
    options = {
        // headless: false,
        executablePath: CHROME_PATH,
        // args: [
        //     `--window-size=${ width },${ height }`
        // ],
    }
    const browser = await puppeteer.launch(options)
    const page = await browser.newPage()
    main_page = await page.goto(
        'https://account.geekbang.org/signin?redirect=https%3A%2F%2Ftime.geekbang.org%2f%3fcategory%3d1'
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
    const columns_articles_content = {}

    // await page.setRequestInterception(true);
    page.on('requestfinished', async res => {
        if (res.resourceType() === 'xhr') {
            // console.log(res.url())
            const parsedUrl = new URL(res.url())
            if (parsedUrl.pathname === '/serv/v1/column/newAll') {
                const resp = await res.response().json()
                resp.data.list.forEach(column => {
                    if (column.had_sub) {
                        // const url = 'https://time.geekbang.org/column/intro/' + id
                        if (COLUMN_ID === 0 || COLUMN_ID === column.id) {
                            columns_dict[column.id] = column
                            columns.push(column.id)
                        }
                    }
                })
            }

            if (parsedUrl.pathname === '/serv/v1/column/intro') {
                const resp = await res.response().json()
                columns_dict[resp.data.id]['column_title'] = resp.data.column_title
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
                })
                columns_articles_dict[cid] = articles
            }

            if (parsedUrl.pathname === '/serv/v1/article') {
                const resp = await res.response().json()
                const article_id = resp.data.id
                const article_content = resp.data.article_content
                columns_articles_content[article_id] = article_content
                // console.log(article_content)
            }
        }
    })

    await page.waitForNavigation()
    await page.waitForSelector('#app > div.page-home > div.content > ul > li:nth-child(1)')
    // await page.screenshot({ path: 'geekbang-columns.png' });

    page.setViewport({
        height: height,
        width: width
    });

    // console.log(columns)
    for (let i = 0; i < columns.length; i++) {
        column = columns_dict[columns[i]]
        // console.log(column)
        const url = 'https://time.geekbang.org/column/intro/' + column.id
        await page.goto(url, {
            waitUntil: 'networkidle0'
        })

        data_path = 'data'
        if (!fs.existsSync(data_path)) {
            fs.mkdirSync(data_path)
        }

        column_title = column.column_title
        column_path = path.join(data_path, column_title)
        if (!fs.existsSync(column_path)) {
            fs.mkdirSync(column_path)
        }

        pdf_file_path = path.join(column_path, '0-00---课程介绍.pdf')
        
        await page.evaluate(() => {
            const bottom = document.getElementsByClassName('bottom')[0];
            if (bottom) {
                bottom.parentNode.removeChild(bottom);
            }
        });

        await page.pdf({
            path: pdf_file_path
        })
    }

    for (let i = 0; i < columns.length; i++) {
        column_title = columns_dict[columns[i]].column_title
        column_title = column_title.replace(/[/\\\?%*:\|"<>\.& ]/g, '')
        console.log(column_title)
        articles = columns_articles_dict[columns[i]]

        data_path = 'data'
        column_path = path.join(data_path, column_title)

        for (let i = 0; i < articles.length; i++) {
            const url = 'https://time.geekbang.org/column/article/' + articles[i].id
            console.log(url)
            const max_retry = 3
            const FIRST_TRY = 0
            const SECOND_TRY = 1
            const Third_TRY = 2
            for (let n = 0; n < max_retry; n++) {
                try {
                    
                    if (n == FIRST_TRY) {
                        await page.goto(url, { timeout: 10000, waitUntil: [ 'load', 'networkidle0' ] });
                    }
                    
                    if (n == SECOND_TRY) {
                        await page.goto(url, { timeout: 10000, waitUntil: [ 'load', 'networkidle2' ] });
                    }

                    if (n == Third_TRY) {
                        await page.goto(url);
                        await page.screenshot();
                    }

                    title_selector = 'h1'
                    await page.waitForSelector(title_selector)

                    title = await page.$eval(title_selector, title => title.innerText)
                    title = title.replace(/[/\\\?%*:\|"<>\.& ]/g, '-')
                    title = i.toString() + '-' + title
                    console.log(title)
                    pdf_file_path = path.join(column_path, title + '.pdf')

                    const collapse_comment_selector = await page.$x('//span[text()="展开"]');
                    for (let i = 0; i < collapse_comment_selector.length; i++ ) {
                        const comment = collapse_comment_selector[i];
                        await comment.click();
                    }

                    await page.pdf({
                        path: pdf_file_path
                    });

                    try {
                        audio_selector = 'audio'
                        const audio_url = await page.$eval(audio_selector, audio => audio.src)
                        // console.log(audio_url)
                        audio_file_path = path.join(column_path, title + '.mp3')
                        const cmd = GOHLS_PATH + audio_url + ' ' + audio_file_path
                        console.log(cmd);
                        child_process.execSync(cmd, { stdio: 'ignore' });
                    } catch (error) {
                        console.log('no audio')
                    }

                    try {
                        const article_content = columns_articles_content[articles[i].id]
                        // console.log(article_content)
                    } catch (error) {
                        console.log(error)
                        console.log('no video')
                    }

                    break
                } catch (error) {
                    if (n >= Third_TRY) {
                        console.log(error)
                        console.log(`get error ----> ${url}`)
                    }
                } 
            }
        }
    }
    await browser.close()
})()