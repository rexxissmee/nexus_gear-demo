import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Path to store dynamic security config (LSTM vs Rule-Based mode)
const CONFIG_PATH = path.join(process.cwd(), 'security_config.json')

export interface SecurityConfig {
    scoringMode: 'lstm' | 'rule_based'
}

// Default config if file is missing
const DEFAULT_CONFIG: SecurityConfig = {
    scoringMode: 'lstm'
}

/**
 * Lấy cấu hình mode hiện tại
 * GET /api/security/scoring-mode
 */
export async function GET() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            // Write default config if it doesn't exist
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
            return NextResponse.json({ mode: 'lstm' })
        }
        const fileContent = fs.readFileSync(CONFIG_PATH, 'utf-8')
        const config = JSON.parse(fileContent)
        const mode = config.scoringMode || 'lstm'
        return NextResponse.json({ mode })
    } catch (err) {
        console.error('[Config API] Error reading config:', err)
        return NextResponse.json({ mode: 'lstm' })
    }
}

/**
 * Cập nhật cấu hình mode
 * POST /api/security/scoring-mode
 */
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { mode } = body

        if (mode !== 'lstm' && mode !== 'rule_based') {
            return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
        }

        const newConfig: SecurityConfig = { scoringMode: mode }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2))

        return NextResponse.json({ mode })
    } catch (err) {
        console.error('[Config API] Error writing config:', err)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
