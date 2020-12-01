const fs = require("fs");
const utils = require('./utils');
const jsdom = require('jsdom');
const jquery = require('jquery');
var ExifImage = require('exif').ExifImage;
const unzipper = require("unzipper");
var fsExtra = require('fs-extra');
const utf8 = require('utf8');
const ExifReader = require('exifreader');
var xl = require('excel4node');

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

    var xlwb = new xl.Workbook();
    var xlws = xlwb.addWorksheet('Images Report');

    var hStyle = xlwb.createStyle({
        font: {
            color: '#000000',
            size: 13,
            bold: true,
        },
        alignment: {
            horizontal: 'center'
        },
        border: {
            outline: true
        }
        // numberFormat: '$#,##0.00; ($#,##0.00); -',
    });

    var bStyle = xlwb.createStyle({
        font: {
            color: '#000000',
            size: 12,
        },
        alignment: {
            shrinkToFit: true,
            wrapText: true
        },
        border: {
            outline: true
        }
        // numberFormat: '$#,##0.00; ($#,##0.00); -',
    });
    

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

            let head = jquery_ref('head');
            let body = jquery_ref('body');

            head.append(`
            <style>
                #images table th {
                    text-align: center;
                    background-color: #065EC2;
                    color: #ffffff;
                }

                #images table th code{
                    color: #ffffff; 
                    background-color: transparent; 
                    border-radius: 0;
                }
            </style>
            `);
            


            var thead = body.find("#image-table").find("thead");
            var tbody = body.find("#image-table").find("tbody");
            thead.find("th:eq(0)").after("<th>File Name</th>");
            thead.find("th:last").after("<th>Asset ID</th>");
            thead.find("th:last").after("<th>Source</th>");
            thead.find("th:last").after("<th>Source File Number</th>");
            thead.find("th:last").after("<th>Keywords</th>");
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
            
            
            xlws.column(1).setWidth(60);
            xlws.column(2).setWidth(50);
            xlws.column(3).setWidth(50);
            xlws.column(4).setWidth(50);
            xlws.column(5).setWidth(80);
            xlws.column(6).setWidth(30);
            xlws.column(7).setWidth(50);
            xlws.column(8).setWidth(50);
            xlws.column(9).setWidth(50);
            xlws.column(10).setWidth(50);
            xlws.column(11).setWidth(50);
            xlws.column(12).setWidth(60);
            xlws.column(13).setWidth(75);

            xlws.row(1).setHeight(50);
            
            
            xlws.cell(1, 1)
                .string('Image')
                .style(hStyle);

            xlws.cell(1, 2)
                .string('File Name')
                .style(hStyle);
            
            xlws.cell(1, 3)
                .string('alt')
                .style(hStyle);
            
            xlws.cell(1, 4)
                .string('aria-describedby')
                .style(hStyle);
                
            xlws.cell(1, 5)
                .string('figcaption')
                .style(hStyle);

            xlws.cell(1, 6)
                .string('Location')
                .style(hStyle);

            xlws.cell(1, 7)
                .string('Role')
                .style(hStyle);

            xlws.cell(1, 8)
                .string('Asset ID')
                .style(hStyle);

            xlws.cell(1, 9)
                .string('Source')
                .style(hStyle);

            xlws.cell(1, 10)
                .string('Source File Number')
                .style(hStyle);
            
            xlws.cell(1, 11)
                .string('Keywords')
                .style(hStyle);
                
            xlws.cell(1, 12)
                .string('Rights Type')
                .style(hStyle);

            xlws.cell(1, 13)
                .string('eProduct credit description and credit')
                .style(hStyle);
            

            processImageProperties();
            
        });

    }


    function addToWS(imageName, imagePath)
    {
        // console.log("addToWS> ",nProcessedCount,jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(1)").html())
        console.log("Add image>>> ", imagePath)

        


        if (imagePath != "" && imagePath != undefined && imagePath != null)
        {
            
            // xlws.addImage({
            //     path: imagePath,
            //     type: 'picture',
            //     position: {
            //     type: 'oneCellAnchor',
            //     from: {
            //         col: 1,
            //         colOff: '0.5in',
            //         row: (nProcessedCount+2),
            //         rowOff: 0,
            //     },
            //     },
            // });

            xlws.addImage({
                path: imagePath,
                type: 'picture',
                position: {
                  type: 'twoCellAnchor',
                  from: {
                    col: 1,
                    colOff: "1mm",
                    row: (nProcessedCount+2),
                    rowOff: "1mm"
                  },
                  to: {
                    col: 1,
                    colOff: "100mm",
                    row: (nProcessedCount+2),
                    rowOff: "100mm"
                  }
                }
              });

        }
        
        xlws.row((nProcessedCount+2)).setHeight(200);

        xlws.cell((nProcessedCount+2), 2)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(1)").html())
            .style(bStyle);
        xlws.cell((nProcessedCount+2), 3)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(2)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 4)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(3)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 5)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(4)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 6)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(5)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 7)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(6)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 8)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(7)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 9)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(8)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 10)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(9)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 11)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(10)").html())
            .style(bStyle);

        xlws.cell((nProcessedCount+2), 12)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(11)").html())
            .style(bStyle);
        
        xlws.cell((nProcessedCount+2), 13)
            .string(jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(12)").html())
            .style(bStyle);

        
                
    }

    function processImageProperties(){
        console.log("Process>>>>>>>>>>>>>>> ",nProcessedCount, nTotalImageCount)
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
            propertiesObj["Keywords"] = "N/A";
            propertiesObj["ImageDescription"] = "N/A";
            propertiesObj["Copyright"] = "N/A";

            try {
                console.log("ExifImage=========================")
                 new ExifImage({ image : imagePath }, function (error, exifData) {
                     if (error){
                         console.log("exifData error");
                         checkXMPData(imageName, imagePath);
                     }else{
                         console.log("exifData> ",exifData)
                         propertiesObj["AssetId"] = exifData["image"].AssetId? exifData["image"].AssetId : "N/A";
                         propertiesObj["Artist"] = exifData["image"].Artist? exifData["image"].Artist : "N/A";
                         propertiesObj["AuthorTitle"] = exifData["image"].AuthorTitle?exifData["image"].AuthorTitle:"N/A";
                         propertiesObj["Keywords"] = exifData["image"].Keywords?exifData["image"].Keywords:"N/A";
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

                xlwb.write('./reports/imagesreport.xlsx', function(err, stats) {
                    if (err) {
                        console.error(err);
                    } else {
                        console.log(stats); // Prints out an instance of a node.js fs.Stats object
                    }
                });
                console.log('REPORT MODIFIED SUCCESSFULLY.');
            });
        }
    }

    function checkXMPData(imageName, imagePath) {
        // try {
            // xmpReader.fromFile(imagePath, (error, data) => {
            //     if (error){
            //         console.log("data error");
            //         utfDecode(imageName);
            //     }else{
            //         console.log("data> ",data)
            //         propertiesObj["AssetId"] = data.AssetId? data.title : propertiesObj["AssetId"];
            //         propertiesObj["Artist"] = data.creator? data.creator : propertiesObj["Artist"];
            //         propertiesObj["AuthorTitle"] = data.title? data.title : propertiesObj["AuthorTitle"];
            //         propertiesObj["ImageDescription"] = data.description? data.description : propertiesObj["ImageDescription"];
            //         propertiesObj["Copyright"] = data.Copyright? data.Copyright : propertiesObj["Copyright"];

            //         utfDecode(imageName);
            //     }
            console.log("XMP read file> ",nProcessedCount);
            if (
                imageName.toLowerCase().indexOf('.png') != -1 || 
                imageName.toLowerCase().indexOf('.jpg') != -1 ||
                imageName.toLowerCase().indexOf('.jpeg') != -1 || 
                imageName.toLowerCase().indexOf('.tif') != -1 || 
                imageName.toLowerCase().indexOf('.tiff') != -1
            ) {
                fs.readFile(imagePath, (err, fileBuffer) => {
                    if (err) {
                        console.error("Error while reading the file", err);
                        utfDecode(imageName, imagePath);
                    }else{
                        try {
                            console.log("read file nProcessedCount> ",nProcessedCount)
                            const data = ExifReader.load(fileBuffer);
                            // console.log("XMP>>> ",data)
                            propertiesObj["AssetId"] = data.title? data.title.description : propertiesObj["AssetId"];
                            propertiesObj["Artist"] = data.creator? data.creator.description : propertiesObj["Artist"];
                            propertiesObj["AuthorTitle"] = data.AuthorsPosition? data.AuthorsPosition.description : propertiesObj["AuthorTitle"];
                            propertiesObj["Keywords"] = data.Keywords? data.Keywords.description : propertiesObj["Keywords"];
                            propertiesObj["ImageDescription"] = data.description? data.description.description : propertiesObj["ImageDescription"];
                            propertiesObj["Copyright"] = data.rights? data.rights.description : propertiesObj["Copyright"];

                            utfDecode(imageName, imagePath);
                        } catch (error) {
                            console.log('XMP read file Error: ' + error.message);
                            utfDecode(imageName, imagePath);
                        }
                    }
                });
            }else{
                utfDecode(imageName, imagePath);
            }
            
            
        // } catch (error) {
        //     console.log('data Error: ' + error.message);
        //     utfDecode(imageName);
        // }
    }

    function utfDecode(imageName, imagePath) {
        
        console.log("utfDecode..........................")
        try {
            propertiesObj["AssetId"] = utf8.decode(propertiesObj["AssetId"]);
            propertiesObj["Artist"] = utf8.decode(propertiesObj["Artist"]);
            propertiesObj["AuthorTitle"] = utf8.decode(propertiesObj["AuthorTitle"]);
            propertiesObj["Keywords"] = utf8.decode(propertiesObj["Keywords"]);
            propertiesObj["ImageDescription"] = utf8.decode(propertiesObj["ImageDescription"]);
            propertiesObj["Copyright"] = utf8.decode(propertiesObj["Copyright"]);
        } catch (error) {
            console.log('utfDecode Error: ' + error.message);
        }
        
        
        
        

        updateTableData(imageName, imagePath);
    }

    function updateTableData(imageName, imagePath) {
        jquery_ref(allImageListDoms[nProcessedCount]).find("td:eq(0)").after(`<td>${imageName}</td>`)

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["AssetId"]=="N/A"?"":"missing"}">${propertiesObj["AssetId"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["Artist"]=="N/A"?"":"missing"}">${propertiesObj["Artist"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["AuthorTitle"]=="N/A"?"":"missing"}">${propertiesObj["AuthorTitle"]}</td>`);
        
        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["Keywords"]=="N/A"?"":"missing"}">${propertiesObj["Keywords"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["ImageDescription"]=="N/A"?"":"missing"}">${propertiesObj["ImageDescription"]}</td>`);

        jquery_ref(allImageListDoms[nProcessedCount]).find("td:last").after(`<td class="${propertiesObj["Copyright"]=="N/A"?"":"missing"}">${propertiesObj["Copyright"]}</td>`);


        console.log("propertiesObj> ",propertiesObj);

        updateJSON(imageName);

        addToWS(imageName, imagePath);

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
                    json_report["data"]["images"][i]["Keywords"] = propertiesObj.Keywords;
                    json_report["data"]["images"][i]["ImageDescription"] = propertiesObj.ImageDescription;
                    json_report["data"]["images"][i]["Copyright"] = propertiesObj.Copyright;
                }else{
                    json_report["data"]["images"][i]["imageName"] = imageName;
                    json_report["data"]["images"][i]["AssetId"] = "N/A";
                    json_report["data"]["images"][i]["Artist"] = "N/A";
                    json_report["data"]["images"][i]["AuthorTitle"] = "N/A";
                    json_report["data"]["images"][i]["Keywords"] = "N/A";
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








