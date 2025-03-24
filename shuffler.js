const fs = require("fs");
require("dotenv").config();

const TS_REGEX_MAP = new Map([
    [
        (/BUILD_ID: number = (.*?);/g),
        [
            (build_id) => parseInt(build_id) + 1,
            (build_id) => `BUILD_ID: number = ${parseInt(build_id) + 1};`
        ]
    ],
    [
        (/PROD: boolean = (.*?);/g),
        [
            (_) => {},
            (_) => `PROD: boolean = ${process.env.PROD === "true"};`
        ]
    ]
]);

const H_REGEX_MAP = new Map([
    [
        (/BUILD_ID: u32 = (.*?);/g),
        () => `BUILD_ID: u32 = ${ts_results[0]};`
    ],
]);

const ts_results = [];

/** Change build constants. */
fs.readFile("./views/ts/const/consts.ts", "utf8", function(err, data)
{
    if (err) throw new Error("[BUILD] Failed to read consts.ts file, halting execution: " + err);

    for (const [regex, [hash, replace]] of TS_REGEX_MAP.entries())
    {
        const match = regex.exec(data);
        if (match)
        {
            const result = hash(match[1]);
            console.log(`[BUILD] Updated ${match[1]} to ${result}`);
            ts_results.push(result);

            data = data.replace(regex, replace(match[1]));
        }
    };

    /** Update changelog and information. */
    fs.readFile("./changelog.txt", function(err, text)
    {
        if (err) throw new Error("[BUILD] Failed to read changelog.txt file, halting execution: " + err);
        text = text.toString();

        const lines = text.split('\n');
        let html = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/\b\w+\s\d+\w*,\s\d{4}\b/)) {
                if (i !== 0) {
                    html += '</ul><div class=\'line\'></div>';
                }
                html += `<b>${lines[i]}</b><ul>`;
            } else if (lines[i].startsWith('-')) {
                html += `<li>${lines[i].substring(2)}</li>`;
            }
        }

        html += '</ul>';

        data = data.replace(/(CHANGELOG_CONTENT: string = ")(.*?)(";)/, `CHANGELOG_CONTENT: string = "${html}";`);
        
        fs.writeFile("./views/ts/const/consts.ts", data, function(err)
        {
            if (err) throw new Error("[BUILD] Failed to write to consts.ts file, halting execution: " + err);
        });    
    });

    fs.readFile("./information.txt", function(err, text)
    {
        if (err) throw new Error("[BUILD] Failed to read information.txt file, halting execution: " + err);
        text = text.toString();

        const lines = text.split('\n');
        let html = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i - 1] == '' || i == 0)
            {
                if (i != 0) html += '</ul><div class=\'line\'></div>';
                html += `<b>${lines[i]}</b><ul>`;
            }
            else if (lines[i].startsWith('-')) {
                html += `<li>${lines[i].substring(2)}</li>`;
            }
            // if (lines[i].match(/\b\w+\s\d+\w*,\s\d{4}\b/)) {
            //     if (i !== 0) {
            //         html += '</ul><div class=\'line\'></div>';
            //     }
            //     html += `<b>${lines[i]}</b><ul>`;
            // } else if (lines[i].startsWith('-')) {
            //     html += `<li>${lines[i].substring(2)}</li>`;
            // }
        }

        html += '</ul>';

        data = data.replace(/(INFORMATION_CONTENT: string = ")(.*?)(";)/, `INFORMATION_CONTENT: string = "${html}";`);
        
        fs.writeFile("./views/ts/const/consts.ts", data, function(err)
        {
            if (err) throw new Error("[BUILD] Failed to write to consts.ts file, halting execution: " + err);
        });    
    });


    fs.readFile("./server/src/utils/config.rs", "utf8", function(err, hData)
    {
        if (err) throw new Error("[BUILD] Failed to read config.rs file, halting execution: " + err);

        for (const [regex, replace] of H_REGEX_MAP.entries())
        {
            const match = regex.exec(hData);
            if (match) hData = hData.replace(regex, replace());
        }

        fs.writeFile("./server/src/utils/config.rs", hData, function(err)
        {
            if (err) throw new Error("[BUILD] Failed to write to consts.h file, halting execution: " + err);
        });

        console.log("[BUILD] Build complete.");
    });
});