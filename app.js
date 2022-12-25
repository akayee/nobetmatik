
import fetch from "node-fetch";
import baslangicbitistarihi from "./baslangicbitistarihi.json" assert { type: "json" };
import fs from "fs";
import moment from 'moment';
import DosyadakiNobetler from "./nobetler.json" assert { type: "json" };
import DosyadakiCalisanlar from "./Calisanlar.json" assert { type: "json" };
import DosyadakiResmiTatiller from "./resmiTatiller.json" assert { type: "json" };
import { createObjectCsvWriter } from 'csv-writer'

let TumCalisanlar = DosyadakiCalisanlar
let Nobetler = DosyadakiNobetler
var selectedUser = false
//Kurallar
//1-yıl ve ay içinde adil sayıda nöbet
//2-resmi tatiller adil dağıtılcak
//3-cumartesi tutan perşembe tutacak
//4-pazar tutan cuma tutacak
//5-iki nöbet arası en az 7 gün olacak
//6-yıllık izinler girilcek ona göre o ay ayarlanacak
//7-nöbetleri sabit dosyaya ekleyecek


function writeCalisanlarJsontoFile(TumCalisanlar) {
    const jsonString = JSON.stringify(TumCalisanlar)
    fs.writeFileSync('./Calisanlar.json', jsonString)
}

function writeNobetlerJsontoFile(Nobetler) {
    const jsonString = JSON.stringify(Nobetler)
    fs.writeFileSync('./nobetler.json', jsonString)
}

async function convertCSV() {
    const days = ["Pazar", "Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi"]
    const csvWriter = createObjectCsvWriter({
        path: `./nobetler.csv`,
        header: [
            { id: 'nobet', title: 'NOBETLER' }
        ]
    });
    let records = []
    let row = []
    for (let m = moment(baslangicbitistarihi.baslangic, "DD-MM-YYYY"); m.isBefore(moment(baslangicbitistarihi.bitis, "DD-MM-YYYY")); m.add(1, 'days')) {
        const day = m.date() - 1
        const month = m.month()
        const year = m.year()

        let nobetci = Nobetler[year][month][day]
        let nobet = {nobet:m.format("DD-MM-YYYY") + " /" + days[m.day()] + ": " + TumCalisanlar[nobetci].isim + "(" + TumCalisanlar[nobetci].yillikNobetSayisi + ")"}
        records.push(nobet)

    }
    console.log(records);
    csvWriter.writeRecords(records)       // returns a promise
        .then(() => {
            console.log('...Done');
        });

}

function setNobetYerlestir(user, date, resmiTatil, workDay) {
    let updatedUserInfo = user
    let momentDate = moment(date, 'DD-MM-YYYY')
    updatedUserInfo = {
        ...user,
        yillikNobetSayisi: parseInt(updatedUserInfo.yillikNobetSayisi) + 1,
        aylikNobetSayisi: parseInt(updatedUserInfo.aylikNobetSayisi) + 1,
        sonNobet: moment(date).format('DD-MM-YYYY')
    }
    resmiTatil !== undefined ? updatedUserInfo = { ...updatedUserInfo, resmiTatilNobetSayisi: parseInt(updatedUserInfo.resmiTatilNobetSayisi) + 1 } : null
    workDay === "Persembe" ? updatedUserInfo = { ...updatedUserInfo, persembeNobetSayisi: parseInt(updatedUserInfo.persembeNobetSayisi) + 1 } : null
    workDay === "Cuma" ? updatedUserInfo = { ...updatedUserInfo, cumaNobetSayisi: parseInt(updatedUserInfo.cumaNobetSayisi) + 1 } : null
    workDay === "Cumartesi" ? updatedUserInfo = { ...updatedUserInfo, cumartesiNobetSayisi: parseInt(updatedUserInfo.cumartesiNobetSayisi) + 1 ,cumartesiNobetTarihi:momentDate} : null
    workDay === "Pazar" ? updatedUserInfo = { ...updatedUserInfo, pazarNobetSayisi: parseInt(updatedUserInfo.pazarNobetSayisi) + 1 , pazarNobetTarihi:momentDate} : null
    TumCalisanlar[user.sicil] = updatedUserInfo
    let updatedArray = Nobetler[momentDate.year()][momentDate.month()]
    updatedArray.push(user.sicil)
    Nobetler[momentDate.year()][momentDate.month()] = updatedArray
}

function checkOffDay(date, user) {
    let notExist = true
    user.izinler.forEach(izin => {
        if (moment(izin, "DD-MM-YYYY").isSame(moment(date, "DD-MM-YYYY"))) {
            notExist = false
        }
    })
    return notExist
}

function checkAlreadyWorked(date, user) {
    if (moment(date).diff(moment(user.sonNobet, "DD-MM-YYYY"), "days") < 8) {
        return true
    } else if (moment(date).day() === 0 || moment(date).day() === 6) {
        if (moment(user.cumartesiNobetTarihi).month() === moment(date).month() || moment(user.pazarNobetTarihi).month() === moment(date).month()) {
            return true
        }
    } else {
        return false
    }
}

function checkRuleBreakerWorked(date, user, dayCount) {
    console.log("KURAL BOZULDUUUUUUUUUUU");
    if (moment(date).diff(moment(user.sonNobet, "DD-MM-YYYY"), "days") < dayCount) {
        return true
    } else {
        return false
    }
}

function checkRuleBreaker(m, daycount) {
    let ruleBreaked = false
    let firstInitial = true
    TumCalisanlar.every(user => {
        if (checkOffDay(m, user)) {
            if (firstInitial === true) {
                selectedUser = user
                firstInitial = false
                return true
            } else if (checkRuleBreakerWorked(m, user, daycount)) {
                return true
            } else if (parseInt(user.yillikNobetSayisi) === 0) {
                selectedUser = user
                userChanged = true
                return false
            } else {
                selectedUser = user
                ruleBreaked = true
            }

        } else {
            return true
        }

        return true
    })
    return ruleBreaked
}

async function check() {
    let simdi = moment(baslangicbitistarihi.baslangic, "DD-MM-YYYY")
    let bitis = moment(baslangicbitistarihi.bitis, "DD-MM-YYYY")
    const resmiTatiller = DosyadakiResmiTatiller
    let firstInitial
    for (let m = moment(simdi); m.isBefore(bitis); m.add(1, 'days')) {
        firstInitial = true
        const year = m.year()
        const month = m.month()
        const day = m.day()
        let workDay = "normal"
        if (day === 0) {
            workDay = "Pazar"
        } else if (day === 6) {
            workDay = "Cumartesi"
        } else if (day === 5) {
            workDay = "Cuma"
        } else if (day === 4) {
            workDay = "Persembe"
        }
        let resmiTatil
        if (resmiTatiller.find(resmiTatil => m.isSame(moment(resmiTatil.localeDateString, "DD-MM-YYYY")))) {
            resmiTatil = "ResmiTatil"
        }
        let userChanged = false
        TumCalisanlar.every(user => {
            if (checkOffDay(m, user)) {
                if (checkAlreadyWorked(m, user)) {
                    return true
                }
                if (firstInitial === true) {
                    selectedUser = user
                    userChanged = true
                    firstInitial = false
                    return true
                }
                if (parseInt(user.yillikNobetSayisi) === 0) {
                    selectedUser = user
                    userChanged = true
                    return false
                }
                if (parseInt(user.yillikNobetSayisi) < parseInt(selectedUser.yillikNobetSayisi)) {
                    selectedUser = user
                    userChanged = true
                    return true
                }
                if (resmiTatil) {
                    if (parseInt(user.resmiTatilNobetSayisi) < parseInt(selectedUser.resmiTatilNobetSayisi)) {
                        selectedUser = user
                        userChanged = true
                        return true
                    }
                }
                if (workDay === "Persembe") {
                    if (parseInt(user.persembeNobetSayisi) < parseInt(selectedUser.persembeNobetSayisi)) {
                        selectedUser = user
                        userChanged = true
                        return true
                    }
                }
                if (workDay === "Cuma") {
                    if (parseInt(user.cumaNobetSayisi) < parseInt(selectedUser.cumaNobetSayisi)) {
                        selectedUser = user
                        userChanged = true
                        return true
                    }
                }
                if (workDay === "Cumartesi") {
                    if (parseInt(user.cumartesiNobetSayisi) < parseInt(selectedUser.cumartesiNobetSayisi)) {
                        selectedUser = user
                        userChanged = true
                        return true
                    }
                }
                if (workDay === "Pazar") {
                    if (parseInt(user.pazarNobetSayisi) < parseInt(selectedUser.pazarNobetSayisi)) {
                        selectedUser = user
                        userChanged = true
                        return true
                    }
                }
            } else {
                return true
            }
            console.log("Kullanıcı Değişimi", userChanged);
            return true
        })
        if (!userChanged) {
            if (!checkRuleBreaker(m, 7)) {
                if (!checkRuleBreaker(m, 6)) {
                    if (!checkRuleBreaker(m, 5)) {
                        if (!checkRuleBreaker(m, 4)) {
                            console.log("Çalışanlar Nönet Tutamaz");

                        }
                    }
                }
            }

        }
        if (!Nobetler[year]) {
            Nobetler = { ...Nobetler, [year]: {} }

        }
        if (!Nobetler[year][month]) {
            Nobetler = { ...Nobetler, [year]: { ...Nobetler[year], [month]: [] } }
        }
        // Nobetler = { ...Nobetler,[m.year()]:yeniliste}

        setNobetYerlestir(selectedUser, m, resmiTatil, workDay)
        console.log("İlgili gün dolu.");

    }
    console.log("Nobetler",Nobetler);
    console.log("Tum Calisanlar", TumCalisanlar);
    writeNobetlerJsontoFile(Nobetler)
    writeCalisanlarJsontoFile(TumCalisanlar)

    if (!firstInitial) {
        convertCSV()
    }


}
check()