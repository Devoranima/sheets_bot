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

    await monitor(top, day_start);
    let scanner = setInterval(async() => {
        try {
            await monitor(top, day_start);
        } catch (error) {
            write('./logs.txt', 'Error at monitor high level: ' + error.toString()+'\n');
        }
    }, 30000);
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
            await top.loadCells('A1:E10000');
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
            contractaddress:process.env.TOKEN,
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