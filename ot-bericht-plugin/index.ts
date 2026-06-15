import { api, opendiscord } from "#opendiscord"
import * as discord from "discord.js"
import axios from "axios"

import messageData from "./message.js"

console.log(
    "[OT BERICHT] INDEX LOADED"
)

declare module "#opendiscord-types" {

    export interface ODPluginManagerIds_Default {
        "ot-bericht-plugin": api.ODPlugin
    }

    export interface ODSlashCommandManagerIds_Default {
        "ot-bericht-plugin:sollicitatie": api.ODSlashCommand
    }

    export interface ODTextCommandManagerIds_Default {
        "ot-bericht-plugin:sollicitatie": api.ODTextCommand
    }

    export interface ODCommandResponderManagerIds_Default {
        "ot-bericht-plugin:sollicitatie": {
            source: "slash" | "text",
            params: {},
            workers: "ot-sollicitatie-bericht:sollicitatie"
        }
    }

}

// AJB NIET AANPASSEN DIT IS EEN API
const CURRENT_VERSION = "2.0.0"

/*
========================================
API FAILOVER
========================================
*/

const API_ENDPOINTS = [
    "https://api.serversphere.nl"
]

let ACTIVE_API =
    API_ENDPOINTS[0]

async function getWorkingApi(): Promise<string | null> {

    for (const endpoint of API_ENDPOINTS) {

        try {

            await axios.get(
                `${endpoint}/api/ping`,
                {
                    timeout: 3000
                }
            )

            ACTIVE_API =
                endpoint

            return endpoint

        } catch {

            console.log(
                `[OT SOLLICITATIE] API OFFLINE: ${endpoint}`
            )

        }

    }

    return null

}

/*
========================================
UPDATE CHECK
========================================
*/

async function checkForUpdates() {

    const workingApi =
        await getWorkingApi()

    if (!workingApi) {

        console.log(
            "[OT SOLLICITATIE] GEEN API BESCHIKBAAR"
        )

        return
    }

    try {

        const response = await axios.get(
            `${ACTIVE_API}/api/check-update?version=${CURRENT_VERSION}`,
            {
                timeout: 5000
            }
        )

        const data =
            response.data

        const latestVersion =
            data.latestVersion

        if (
            !latestVersion ||
            latestVersion === CURRENT_VERSION
        ) {
            return
        }

        const downloadUrl =
            data.downloadUrl || ACTIVE_API

        console.log(
            `[OT SOLLICITATIE] ⚠️ UPDATE BESCHIKBAAR`
        )

        console.log(
            `[OT SOLLICITATIE] ${CURRENT_VERSION} -----> ${latestVersion}`
        )

        console.log(
            `[OT SOLLICITATIE] Download: ${downloadUrl}`
        )

        const client =
            opendiscord.client as unknown as discord.Client

        for (const guild of client.guilds.cache.values()) {

            try {

                await guild.members.fetch()

                const admins =
                    guild.members.cache.filter(member =>

                        member.permissions.has(
                            discord.PermissionFlagsBits.Administrator
                        ) &&

                        !member.user.bot

                    )

                for (const [, admin] of admins) {

                    try {

                        await admin.send(

`⚠️ UPDATE BESCHIKBAAR ⚠️

${CURRENT_VERSION} -----> ${latestVersion}

Download:
${downloadUrl}`

                        )

                    } catch {}

                }

            } catch {}

        }

    } catch (error) {

        console.log(
            "[OT SOLLICITATIE] UPDATE CHECK FAILED"
        )

    }

}

/*
========================================
AUTO UPDATE CHECK
========================================
*/

setTimeout(() => {

    checkForUpdates()

    setInterval(() => {

        checkForUpdates()

    }, 3600000)

}, 300)

/*
========================================
SLASH COMMAND
========================================
*/

opendiscord.events.get("onSlashCommandLoad")?.listen((slash) => {

    slash.add(
        new api.ODSlashCommand(
            "ot-bericht-plugin:sollicitatie",
            {
                name: "sollicitatie",
                description: "Stuur sollicitatie formulier",
                type: discord.ApplicationCommandType.ChatInput,
                contexts: [
                    discord.InteractionContextType.Guild
                ],
                integrationTypes: [
                    discord.ApplicationIntegrationType.GuildInstall
                ]
            }
        )
    )

})

/*
========================================
TEXT COMMAND
========================================
*/

opendiscord.events.get("onCommandResponderLoad")?.listen((commands) => {

    const generalConfig =
        opendiscord.configs.get("opendiscord:general")

    commands.add(

        new api.ODCommandResponder(
            "ot-bericht-plugin:sollicitatie",
            generalConfig.data.prefix,
            "sollicitatie"
        )

    )

    commands.get(
        "ot-bericht-plugin:sollicitatie"
    )?.workers.add([

        new api.ODWorker(
            "ot-bericht-plugin:sollicitatie",
            0,
            async (instance) => {

                const channel = instance.channel

                if (!(channel instanceof discord.TextChannel)) {
                    return
                }

                await channel.send(
                    messageData.message
                )

            }
        )

    ])

})

export default {}