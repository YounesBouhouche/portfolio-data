import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, extname } from 'path'

const REPO = 'YounesBouhouche/portfolio-data'
const BRANCH = 'main'
const BASE_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif']

const config = JSON.parse(readFileSync('portfolio.config.json', 'utf-8'))

const projects = config.projects.map((project) => {
    if (!project.assets) {
        console.warn(`No "assets" field for project: ${project.repo}`)
        return { ...project, heroImage: null, screenshots: [] }
    }
    const assetsFolder = join('assets', project.assets)

    if (!existsSync(assetsFolder)) {
        console.warn(`⚠️  No assets folder found for: ${project.assets}`)
        return { ...project, heroImage: null, screenshots: [] }
    }

    const files = readdirSync(assetsFolder)
        .filter((f) => IMAGE_EXTS.includes(extname(f).toLowerCase()))
        .sort()

    const heroFile = files.find((f) => f.startsWith('hero.'))
    const screenshotFiles = files.filter((f) => !f.startsWith('hero.'))

    const toUrl = (filename) =>
        `${BASE_URL}/assets/${project.assets}/${filename}`

    return {
        ...project,
        heroImage: heroFile ? toUrl(heroFile) : null,
        screenshots: screenshotFiles.map(toUrl),
    }
})

const output = {
    generatedAt: new Date().toISOString(),
    projects,
}

writeFileSync('data.json', JSON.stringify(output, null, 2))
console.log(`data.json generated with ${projects.length} projects`)