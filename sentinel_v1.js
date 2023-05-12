const axios = require('axios');
const { GoogleSpreadsheet } = require('google-spreadsheet');

const creds = require('./testfield-386413-25ca2288a487.json');
const { Console, log } = require('console');

const token = '0x2f90907fD1DC1B7a484b6f31Ddf012328c2baB28';

const tst = '19o_EBhDeJ9x_NHbihCPv9H9aXfWFNUTcYU68QmYXLcs';
const sheet = '1RPjRZ3V0wtFMDE-zdSnIsBnedaMM1xrbjyg_YgwhGRc';

const N = 500;

(async function (){
    console.log('Starting...');
    const doc = new GoogleSpreadsheet(sheet);
    await doc.useServiceAccountAuth(creds);

    await doc.loadInfo(); // loads document properties and worksheets
    const top = doc.sheetsByIndex[0];
    const morrons = doc.sheetsByIndex[1];
    const day_start = doc.sheetsByIndex[2];

    let new_day = setInterval( function(){ 
        const date = new Date();
        let hour = date.getHours();
        let minutes = date.getMinutes();
        if (hour == 0) {
            dayStartCorrection(day_start); 
        }
    } , 1000*60*60);

    let scanner = setInterval(() => {
        monitor(top, morrons, day_start);
    }, 5000);
})()

async function monitor(top, alert, day_start){
    const response = (await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'token',
            action:'getTokenHolders',
            contractaddress:token,
            page:0,
            offset:N
        }
    }))
    if (response.data.result){
        //* loads range of cells into local cache - DOES NOT RETURN THE CELLS
        await top.loadCells('A2:D1000');
    
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

        //*Raw rows from Google Sheets
        const sheet_current_rows = await top.getRows();
        
        //*Wallets data we get from our Google Sheets
        let sheet_current_wallets = [...sheet_current_rows.map(e =>{
            return {
                address: e.address,
                start: e.start,
                current: e.current
            }
        })];
        sheet_current_wallets = [...sheet_current_wallets.filter((e, index)=> (index > 2 && e.address != ''))]

        //*Array of sheets top N addresses
        const sheet_current_addresses = [...sheet_current_wallets.map(e=>e.address)];

    ///////////////////////////////////////////////////////////////

        //*Raw rows from Day Start Sheet
        const sheet_day_start_rows = await day_start.getRows();
        
        //*Wallets data we get from our Day Start Sheet
        let sheet_day_start_wallets = [...sheet_day_start_rows.map(e =>{
            return {
                address: e.address,
                start: e.start
            }
        })];
        sheet_day_start_wallets = [...sheet_day_start_wallets.filter((e, index)=> index > 1)]

        //*Array of Day Start Sheet's addresses
        const sheet_day_start_addresses = [...sheet_day_start_wallets.map(e=>e.address)];

        await correctAlert(alert, api_current_addresses, sheet_current_wallets);
        await correctTop(top, api_current_wallets, api_current_addresses, sheet_day_start_wallets, sheet_day_start_addresses);

    }
    else console.log('network too busy...');
}

async function correctAlert(ex, api_current_addresses, sheet_current_wallets){
    let array_alerts = [];
    for(let i = 0; i < sheet_current_wallets.length; i++){
        const address = sheet_current_wallets[i].address;
        const start = sheet_current_wallets[i].start;
        // array_alerts.push({
        //     address: address,
        //     date: getCurrentDate(),
        //     start: start,
        //     current: await getCurrentHoldings(address)
        // })
        if(api_current_addresses.includes(address) == false){
            array_alerts.push({
                address: address,
                date: getCurrentDate(),
                start: start,
                current: await getCurrentHoldings(address)
            })
        }
    }
    // console.log(array_alerts);
    await ex.addRows([...array_alerts])
}

async function correctTop(top,api_current_wallets, api_current_addresses, sheet_day_start_wallets, sheet_day_start_addresses){
    for (let i = 0; i < N; i++){
        const api_address = api_current_addresses[i];
        const api_current_holds = api_current_wallets[i].current; 

        const cell_address = top.getCell(i+3, 0);
        const cell_start = top.getCell(i+3, 1);
        const cell_current = top.getCell(i+3, 2);

        
        const index_in_start = sheet_day_start_addresses.indexOf(api_address);
        // console.log(api_address, index_in_start);
        const start_hold = sheet_day_start_wallets[index_in_start].start;
        cell_address.value = api_address;
        cell_start.value = start_hold;
        cell_current.value = api_current_holds;
    }
    await top.saveUpdatedCells();
}

async function dayStartCorrection(sheet){
    const response = (await axios.get('https://explorer.dogechain.dog/api', {
        params: {
            module:'token',
            action:'getTokenHolders',
            contractaddress:token,
            page:0,
            offset:10000
        }
    }))
    if (response.data.result){
        let api_current_wallets = response.data.result;
        api_current_wallets = [...api_current_wallets.map((e)=>{
            return {
                address: e.address,
                start: (Math.round(e.value/(10**18)*100)/100)
            }
        })]
        await sheet.clearRows();
        api_current_wallets.unshift({
            address: '',
            start: ''
        });
        api_current_wallets.unshift({
            address: 'Wallet',
            start: 'DayStartBalanc'
        });
        await sheet.addRows([...api_current_wallets]);
    }
    else console.log('network too busy...');
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
    const value = (Math.round(response.data.result/(10**18)*100)/100)

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


async function test(sheet){
    // await sheet.loadCells('A2:E101');
    // (sheet.getCell(1, 1)).value = 'O kow ko2';
    // await sheet.saveUpdatedCells();
    // const rows = await sheet.getRows();
    // console.log(rows[3])
    // console.log(getCurrentDate())
}