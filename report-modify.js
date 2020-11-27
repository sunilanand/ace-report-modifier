const fs = require("fs");
const utils = require('./utils');
const jsdom = require('jsdom');
const jquery = require('jquery');
var ExifImage = require('exif').ExifImage;
const unzipper = require("unzipper");
var fsExtra = require('fs-extra');
const xmpReader = require('xmp-reader');



var ReportModifier = function () {
    var nProcessedCount = 0;
    var nTotalImageCount;
    var allImageListDoms;
    var dom;
    var jquery_ref;
    var json_report;
    var epubName;

    var allXHTMLInTOC = [];
    var allImagesXHTML_WIDGET = [];

    var nTocFileCounter = 0;
    var nTotalXHTML_IN_TOC;

    var nTotalJSONS_In_Single_XHTML = 0;
    var nJSONCounter = 0;
    var jsonsPath = [];

    var propertiesObj = new Object();
    

    function init() {
        // // print process.argv
        // process.argv.forEach(function (val, index, array) {
        //     console.log(index + ': ' + val);
        // });
        epubName = process.argv[2];
        //console.log("epubName :: ",epubName);

        extractEpub();
        //readTocFile();
    }

    function extractEpub(){

        utils.deleteDirectory("./input/extracted");
        utils.createDirectory("./input/extracted");


        utils.deleteDirectory("./reports/data/widgets_images");
        utils.createDirectory("./reports/data/widgets_images");

        

        var srcFile = `./input/${epubName}`;

        fs.createReadStream(srcFile)
        .pipe(unzipper.Extract({ path: './input/extracted' }))
        .on('close', () => {
            //console.log('Extract closed')
            readTocFile();
        });

    }

    function readTocFile(){
        var tocFilePath = `./input/extracted/OPS/toc.xhtml`;

        fs.readFile(tocFilePath, 'utf8', (err, data) => {
            const dom = new jsdom.JSDOM(data);
            const $ = jquery(dom.window);
            let allAnchors = $("body").find("a");
            allAnchors.each(function(){
                let _href = $(this).attr("href");
                //console.log(`_href = ${_href}`);

                if(String(_href).indexOf(".xhtml")){
                    if(String(_href).indexOf(".xhtml#")){
                        let _finalXHTML = _href.split("#")[0];
                        allXHTMLInTOC.push(_finalXHTML);
                    }else{
                        allXHTMLInTOC.push(_href);
                    }
                }
            });

            nTotalXHTML_IN_TOC = allXHTMLInTOC.length;

            if(nTocFileCounter < nTotalXHTML_IN_TOC){
                readASingleXhtmlFile();
            }
            
        });
    }

    function readASingleXhtmlFile(){
        fs.readFile(`./input/extracted/OPS/${allXHTMLInTOC[nTocFileCounter]}`, 'utf8', (err, data) => {
            const dom = new jsdom.JSDOM(data);
            const $ = jquery(dom.window);
            let allImagesInXHTML = [];
            $("body").find("img").each(function(){
                //allImages.push($(this).attr("src"));
                let _src = $(this).attr("src");
                let lastIndex = _src.lastIndexOf('/');
                _src = _src.substr(lastIndex+1, _src.length);
                allImagesInXHTML.push(_src.trim());
                
            });

            nTotalJSONS_In_Single_XHTML = 0;
            nJSONCounter = 0;
            jsonsPath = [];


            $("body").find("param").each(function(){
                //allImages.push($(this).attr("src"));
                let _value = $(this).attr("value");
                if(String(_value).toLowerCase().indexOf(".json") != -1){
                    //console.log(`_value = ${_value}`);
                    jsonsPath.push(_value);
                }
            });

            nTotalJSONS_In_Single_XHTML = jsonsPath.length;

            let allImagesInJSONs = getImagesFromJSONFile();

            let lastIndex = String(allXHTMLInTOC[nTocFileCounter]).lastIndexOf('/');
            let xhtml_file_name = String(allXHTMLInTOC[nTocFileCounter]).substr(lastIndex+1, allXHTMLInTOC[nTocFileCounter].length);

            allImagesXHTML_WIDGET.push({
                "XHTML_IMAGES":allImagesInXHTML,
                "JSON_IMAGES":allImagesInJSONs,
                "XHTML_NAME_PATH":[xhtml_file_name,allXHTMLInTOC[nTocFileCounter]],

            });

            //console.log("allImagesInJSONs :: ",allXHTMLInTOC[nTocFileCounter],allImagesInXHTML,allImagesInJSONs);


            if(nTocFileCounter < nTotalXHTML_IN_TOC-1){
                nTocFileCounter++;
                readASingleXhtmlFile();
            }else{
                // All xhtml file read completed from toc.xhtml file
                console.log("ALL DONE  >>>");
                readJSON();
                tableColumnEdit();
            }
           
        });
    }

    function getImagesFromJSONFile(){

        let all_images_in_json = [];

        for(let i=0;i<jsonsPath.length;i++){
            let partialPath = jsonsPath[i];
            partialPath = String(partialPath).split("../").join("");
            let jsonPathActual = `./input/extracted/OPS/assets/${partialPath}`
            let json_report = fs.readFileSync(jsonPathActual,'utf-8');
    
            try{
                json_report = JSON.parse(json_report);
                let _data = getKeyValues(json_report);
                _data = _data.split(",");
    
                for(let j=0;j<_data.length;j++){
                    
                    if(_data[j].indexOf(".jpg") != -1 || _data[j].indexOf(".png") != -1 || _data[j].indexOf(".gif") != -1){
                        let _value = _data[j].split("=")[1];
                        _value = String(_value).split("../").join("");
                        let imageName = _value.split("/");
                        imageName = String(imageName[imageName.length-1]).trim();
                        let src = `./input/extracted/OPS/${_value}`;
                        let dest = `./reports/data/widgets_images/${imageName}`
                        fsExtra.copySync(src, dest);
                        //console.log("partialPath,_value :: ",partialPath,_value);
                        all_images_in_json.push(imageName);
                    }
                }
                
            }catch(e){
    
            }

        }
        return all_images_in_json;

    }

    

    function getKeyValues(data) {
        var q = [];
        var keys = Object.keys(data);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var value = data[key];
            if (value == null) {
                q.push(key + "=''");
            } else if (typeof value == "object") {
                q.push(getKeyValues(value));
            } else {
                q.push(key + "=" + value);
            }
        }
        return q.join(",");
    }

    function tableColumnEdit() {

        let file = "./reports/report.html";
        fs.readFile(file, 'utf8', (err, data) => {
            dom = new jsdom.JSDOM(data);
            jquery_ref = jquery(dom.window);

            let body = jquery_ref('body');
            var thead = body.find("#image-table").find("thead");
            var tbody = body.find("#image-table").find("tbody");
            thead.find("th:eq(0)").after("<th>File Name</th>");
            thead.find("th:last").after("<th>Asset ID</th>");
            thead.find("th:last").after("<th>Source</th>");
            thead.find("th:last").after("<th>Source File Number</th>");
            thead.find("th:last").after("<th>Rights Type</th>");
            thead.find("th:last").after("<th>eProduct credit description and credit</th>");


            // Insert all widgets images

            //console.log("allImagesXHTML_WIDGET : ",allImagesXHTML_WIDGET);

            /*

            for(let i=0;i<allImagesXHTML_WIDGET.length;i++){

                for(let j=0;j<allImagesXHTML_WIDGET[i]["JSON_IMAGES"].length;j++){
                    //console.log("j",j)
                    //tbody.empty();

                    tbody.append(
                        `
                        <tr>
                            <td class="image">
                            <a href="data/widgets_images/${allImagesXHTML_WIDGET[i]["JSON_IMAGES"][j]}">
                                <img src="data/widgets_images/${allImagesXHTML_WIDGET[i]["JSON_IMAGES"][j]}">
                            </a>
                            </td><td class="missing">N/A</td>
        
                            <td class="missing">N/A</td>
        
                            <td class="missing">N/A</td>
        
                            <td class="missing">N/A</td>
        
                            <td class="location">${allImagesXHTML_WIDGET[i]["XHTML_NAME_PATH"][1]}</td>
                        </tr>
                        `
                    )

                }

            }

            */

            let current_TRS = tbody.find("tr");
                
                for(let u=0;u<allImagesXHTML_WIDGET.length;u++){
                    let bottomTrs = '';
                    let found = false;
                    let currentROWItem;
                    for(let k=0;k<current_TRS.length;k++){
                        currentROWItem = jquery_ref(current_TRS[k]);
                        let location_value = jquery_ref(current_TRS[k]).find(".location").text();

                        let trDOM = '';
                        for(let j=0;j<allImagesXHTML_WIDGET[u]["JSON_IMAGES"].length;j++)
                        {
                            trDOM = trDOM + `
                                <tr>
                                <td class="image">
                                <a href="data/widgets_images/${allImagesXHTML_WIDGET[u]["JSON_IMAGES"][j]}">
                                    <img src="data/widgets_images/${allImagesXHTML_WIDGET[u]["JSON_IMAGES"][j]}">
                                </a>
                                </td><td class="missing">N/A</td>
            
                                <td class="missing">N/A</td>
            
                                <td class="missing">N/A</td>
            
                                <td class="missing">N/A</td>
            
                                <td class="location">${allImagesXHTML_WIDGET[u]["XHTML_NAME_PATH"][1]}</td>
                            </tr>
                                `
                        }

                        bottomTrs = trDOM;

                        if(location_value.indexOf(allImagesXHTML_WIDGET[u]["XHTML_NAME_PATH"][0]) != -1){
                            jquery_ref(current_TRS[k]).after(trDOM);
                            found = true;
                            break;
                            
                        }
                    }

                    if(!found){
                        //console.log("ENTRY NOT FOUND IN EARLIER REPORT LISTING");
                        currentROWItem.parent().append(bottomTrs);
                    }

                }
            
            
            allImageListDoms = tbody.find("tr");
            nTotalImageCount = allImageListDoms.length;

            processImageProperties();
            
        });

    }

    function processImageProperties(){
        if(nProcessedCount < nTotalImageCount){
            let imagePath = jquery_ref(jquery_ref(allImageListDoms[nProcessedCount])).find("td:eq(0)").find("img").attr("src");
            imagePath = "./reports/"+imagePath
            let imageName = imagePath;
            // let lastIndex = imageName.lastIndexOf('.');
            // imageName = imageName.substr(0, lastIndex);
            imageName = imageName.split("/");
            imageName = String(imageName[imageName.length-1]).trim();


            /*
            XMP Reader:
            {
                "raw": {
                    "MicrosoftPhoto:Rating": "50",
                    "dc:title": "Title",
                    "dc:description": "Title",
                    "dc:creator": "Alexander Kuznetsov",
                    "Iptc4xmpCore:Location": "New York",
                    "MicrosoftPhoto:LastKeywordXMP": ["tag1", "tag2"],
                    "MicrosoftPhoto:LastKeywordIPTC": ["tag1", "tag2"],
                    "xmp:Rating": "3"
                },
                "rating": 3,
                "title": "Title",
                "description": "Title",
                "creator": "Alexander Kuznetsov",
                "location": "New York",
                "keywords": ["tag1", "tag2"]
            }
            */
            console.log("imageName>>>>>>>>>>> ",imageName)
            propertiesObj = new Object();
            propertiesObj["imageName"] = imageName;
            propertiesObj["AssetId"] = "N/A";
            propertiesObj["Artist"] = "N/A";
            propertiesObj["AuthorTitle"] = "N/A";
            propertiesObj["ImageDescription"] = "N/A";
            propertiesObj["Copyright"] = "N/A";

           try {
                new ExifImage({ image : imagePath }, function (error, exifData) {
                    if (error){
                        console.log("exifData error");
                        checkXMPData(imageName, imagePath);
                    }else{
                        console.log("exifData> ",exifData)
                        propertiesObj["AssetId"] = exifData["image"].AssetId? exifData["image"].AssetId : "N/A";
                        propertiesObj["Artist"] = exifData["image"].Artist? exifData["image"].Artist : "N/A";
                        propertiesObj["AuthorTitle"] = exifData["image"].AuthorTitle?exifData["image"].AuthorTitle:"N/A";
                        propertiesObj["ImageDescription"] = exifData["image"].ImageDescription?exifData["image"].ImageDescription:"N/A";
                        propertiesObj["Copyright"] = exifData["image"].Copyright?exifData["image"].Copyright:"N/A";

                        checkXMPData(imageName, imagePath);
                    }
                });
            } catch (error) {
                console.log('exifData Error: ' + error.message);
                checkXMPData(imageName, imagePath);
            }

        }else{
            let file_output = "./reports/new-report.html";
            fs.writeFile(file_output, dom.serialize(), err => {
                fs.writeFileSync("./reports/new-report.json", JSON.stringify(json_report));
                console.log('REPORT MODIFIED SUCCESSFULLY.');
            });
        }
    }

    function checkXMPData(imageName, imagePath) {
        try {
            xmpReader.fromFile(imagePath, (error, data) => {
                if (error){
                    console.log("data error");
                    updateTableData(imageName);
                }else{
                    console.log("data> ",data)
                    propertiesObj["AssetId"] = data.AssetId? data.AssetId : propertiesObj["AssetId"];
                    propertiesObj["Artist"] = data.creator? data.creator : propertiesObj["Artist"];
                    propertiesObj["AuthorTitle"] = data.title? data.title : propertiesObj["AuthorTitle"];
                    propertiesObj["ImageDescription"] = data.description? data.description : propertiesObj["ImageDescription"];
                    propertiesObj["Copyright"] = data.Copyright? data.Copyright : propertiesObj["Copyright"];

                    updateTableData(imageName);
                }
            });
        } catch (error) {
            console.log('data Error: ' + error.message);
            updateTableData(imageName);
        }
    }

    function updateTableData(imageName) {
        jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(0)").after(`<td>${imageName}</td>`)

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["AssetId"]=="N/A"?"":"missing"}">${propertiesObj["AssetId"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["Artist"]=="N/A"?"":"missing"}">${propertiesObj["Artist"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["AuthorTitle"]=="N/A"?"":"missing"}">${propertiesObj["AuthorTitle"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["ImageDescription"]=="N/A"?"":"missing"}">${propertiesObj["ImageDescription"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["Copyright"]=="N/A"?"":"missing"}">${propertiesObj["Copyright"]}</td>`);


        console.log("propertiesObj> ",propertiesObj);

        updateJSON(imageName);

        nProcessedCount++;
        processImageProperties();
    }

    function updateJSON(imageName){
        for(let i=0;i<json_report["data"]["images"].length;i++){
            if(json_report["data"]["images"][i]["src"].indexOf(imageName) !== -1){
                
                if (imageName.indexOf('.svg') == -1 && imageName.indexOf('.jpg') == -1 && imageName.indexOf('.jpeg') == -1) {
                    json_report["data"]["images"][i]["imageName"] = propertiesObj.imageName;
                    json_report["data"]["images"][i]["AssetId"] = propertiesObj.AssetId;
                    json_report["data"]["images"][i]["Artist"] = propertiesObj.Artist;
                    json_report["data"]["images"][i]["AuthorTitle"] = propertiesObj.AuthorTitle;
                    json_report["data"]["images"][i]["ImageDescription"] = propertiesObj.ImageDescription;
                    json_report["data"]["images"][i]["Copyright"] = propertiesObj.Copyright;
                }else{
                    json_report["data"]["images"][i]["imageName"] = imageName;
                    json_report["data"]["images"][i]["AssetId"] = "N/A";
                    json_report["data"]["images"][i]["Artist"] = "N/A";
                    json_report["data"]["images"][i]["AuthorTitle"] = "N/A";
                    json_report["data"]["images"][i]["ImageDescription"] = "N/A";
                    json_report["data"]["images"][i]["Copyright"] = "N/A";
                }
            }
        }
    }

    function readJSON(){
        json_report = fs.readFileSync('./reports/report.json');
        json_report = JSON.parse(json_report);
    }

    return {
        init: init
    }
}

var reportModifier = new ReportModifier();
reportModifier.init();








