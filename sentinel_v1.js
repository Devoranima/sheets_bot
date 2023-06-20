const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');

const creds = require('./valon-386718-303f828b118b.json');

const N = 10000;

(async function (){
    console.log('starting my watch...');
    const doc = new GoogleSpreadsheet(process.env.SHEET_KEY);
    await doc.useServiceAccountAuth(creds);

    await doc.loadInfo(); // loads document properties and worksheets
    const top = doc.sheetsByTitle.Wallets;
    let day_start = doc.sheetsByTitle.DayStart;
    await day_start.loadCells('A2:B3');

    // await dayStartCorrection(day_start);

//////////////////////////////////////////////////////////////////////////////////
    
//    let new_day = setInterval( async function(){ 
//        const date = new Date();
//        let hour = date.getHours();
//        let minutes = date.getMinutes();
//        if (hour == 1) {
//            try {
///////////////////////////////////////////////////////////////////////////////// 
//                await day_start.updateProperties({ title: getCurrentDate() });

//                const new_sheet = await doc.addSheet({title:'DayStart'});

//                await new_sheet.setHeaderRow(['address', 'start'], 1);

//                await new_sheet.loadCells('A2:B3');
//                for (let i = 0; i < 2; i++){
//                    for (let j = 0; j < 2;j++){
//                        new_sheet.getCell(i+1, j).value = day_start.getCell(i+1, j).value
//                    }
//                }
//                await new_sheet.saveUpdatedCells();

//                day_start = new_sheet;
//////////////////////////////////////////////////////////////////////////////////
//                await dayStartCorrection(day_start);
//            } catch (error) {
//                write('./logs.txt', 'Error at Day Start: ' + error.toString()+'\n');
//            }
//        }
//    }, 1000*60*60);
    // await dayStartCorrection(day_start);
    let new_day = setInterval( async function(){ 
        const date = new Date();
        let hour = date.getHours();
        if (hour == 9) {
            try {
                await dayStartCorrection(day_start);
            } catch (error) {
                write('./logs.txt', 'Error at Day Start: ' + error.toString()+'\n');
            }
        }
    }, 1000*60*60);

    let scanner = setInterval(async() => {
        try {
            await monitor(top, day_start);
        } catch (error) {
            write('./logs.txt', 'Error at monitor high level: ' + error.toString()+'\n');
        }
    }, 15000);
})()

async function monitor(top, day_start){
    
    await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'token',
            action:'getTokenHolders',
            contractaddress:process.env.TOKEN,
            page:0,
            offset:N
        }
    }).then(async (response)=>{

        if (response.data.result){
            
            //* loads range of cells into local cache - DOES NOT RETURN THE CELLS
            await top.loadCells('A1:E5000');
        ////////////////////////////////////////////////////////////////
            //*Wallets data we get from our Dogechain Explorer
            let api_current_wallets = response.data.result;
            api_current_wallets = [...api_current_wallets.map(e=>{
                return {
                    address: e.address,
                    current: (Math.round(e.value/(10**18)*100)/100)
                }
            })]
    
            //*Array of current top N addresses 
            const api_current_addresses = [...api_current_wallets.map(e => e.address)];
    
        ////////////////////////////////////////////////////////////////
            
            try {
                await correctTop(top, day_start, api_current_wallets, api_current_addresses);
            } catch (error) {
                write('./logs.txt', 'Error at Top Sheet Correction function: ' + error.toString()+'\n');
            }
        }
    }).catch((e)=>{
        console.log('network too busy...')
    })
}

async function correctAlert(ex, api_current_addresses, sheet_current_wallets){
    let array_alerts = [];
    for(let i = 0; i < sheet_current_wallets.length; i++){
        const address = sheet_current_wallets[i].address;
        const start = sheet_current_wallets[i].start;
        if(api_current_addresses.includes(address) == false){
            array_alerts.push({
                address: address,
                date: getCurrentDate(),
                start: start,
                current: await getCurrentHoldings(address)
            })
        }
    }
    await ex.addRows([...array_alerts])
}

async function correctTop(top, day_start, api_current_wallets, api_current_addresses){
    for (let i = 0; i < api_current_addresses.length; i++){
        const api_address = api_current_addresses[i];
        const api_current_holds = api_current_wallets[i].current; 

        const cell_address = top.getCell(i+3, 1);
        const cell_current = top.getCell(i+3, 3);

        cell_address.value = api_address;
        cell_current.value = api_current_holds;
    }
    await top.saveUpdatedCells(); 
}

async function dayStartCorrection(day_start){
    console.log('starting correction')
    await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'token',
            action:'getTokenHolders',
            contractaddress:token,
            page:0,
            offset:N
        }
    }).then(async (response)=>{
        
        if (response.data.result){
            
            let api_current_wallets = response.data.result;
            api_current_wallets = [...api_current_wallets.map((e)=>{
                return {
                    address: e.address,
                    start: (Math.round(e.value/(10**18)*100)/100)
                }
            })]
            await day_start.clearRows({start: 2});
            const second = {
                address:'Wallets',
                start: 'DayStart'
            }
            const third = {
                address:'empty',
                start: 'string'
            }
            
            await day_start.addRows([second, third, ...api_current_wallets]);
            
        }
    }).catch((e)=>{
        console.log(e);
    }
    )
    console.log('correction done')
}


//////////////////////////////////////////////////////////////////////////////

const getCurrentHoldings = async (address) => {
    const response = (await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'account',
            action:'tokenbalance',
            contractaddress:token,
            address:address
        }
    }))
    const value = (Math.round(response.data.result/(10**18)*100)/100);
    return value;
}

const getCurrentDate = ()=>{
    var today = new Date();
    const date = []
    date.push(String(today.getDate()).padStart(2, '0'));
    date.push(String(today.getMonth() + 1).padStart(2, '0'));
    date.push((String(today.getFullYear())).slice(2))
    today = date.join('.');
    return (today);
}

const write = (path_to_file, content)=>{
    fs.writeFile(path_to_file, content, { flag: 'a' }, err => {
        if (err) {
          console.error(err);
        }
    });
}



async function test(sheet){
    await sheet.updateProperties({ title: getCurrentDate() });
}