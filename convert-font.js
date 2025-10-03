// Font converter: TTF/OTF to Three.js typeface.json
// Run: node convert-font.js

const opentype = require('opentype.js');
const fs = require('fs');

const inputFont = 'fonts/Balloony Regular.ttf';
const outputFile = 'fonts/Balloony_Regular.json';

console.log('🔄 Loading font:', inputFont);

opentype.load(inputFont, (err, font) => {
    if (err) {
        console.error('❌ Error loading font:', err);
        process.exit(1);
    }

    console.log('✅ Font loaded:', font.names.fontFamily.en);
    console.log('🔄 Converting to Three.js format...');

    const glyphs = {};

    // Convert all glyphs
    font.glyphs.glyphs.forEach(glyph => {
        if (!glyph.unicode) return;

        const char = String.fromCharCode(glyph.unicode);
        const path = glyph.getPath(0, 0, 72);

        glyphs[char] = {
            ha: Math.round(glyph.advanceWidth),
            x_min: Math.round(glyph.xMin || 0),
            x_max: Math.round(glyph.xMax || glyph.advanceWidth),
            o: convertPath(path)
        };
    });

    const typefaceData = {
        glyphs: glyphs,
        familyName: font.names.fontFamily.en,
        ascender: Math.round(font.ascender),
        descender: Math.round(font.descender),
        underlinePosition: Math.round(font.tables.post.underlinePosition || -100),
        underlineThickness: Math.round(font.tables.post.underlineThickness || 50),
        boundingBox: {
            yMin: Math.round(font.descender),
            yMax: Math.round(font.ascender),
            xMin: 0,
            xMax: Math.round(font.ascender)
        },
        resolution: 1000,
        original_font_information: {
            format: 0,
            copyright: font.names.copyright?.en || '',
            fontFamily: font.names.fontFamily.en,
            fontSubfamily: font.names.fontSubfamily?.en || 'Regular',
            uniqueID: font.names.uniqueID?.en || '',
            fullName: font.names.fullName?.en || font.names.fontFamily.en,
            version: font.names.version?.en || '1.0',
            postScriptName: font.names.postScriptName?.en || font.names.fontFamily.en.replace(/\s/g, ''),
            trademark: font.names.trademark?.en || '',
            manufacturer: font.names.manufacturer?.en || '',
            designer: font.names.designer?.en || '',
            manufacturerURL: font.names.manufacturerURL?.en || '',
            designerURL: font.names.designerURL?.en || '',
            licence: font.names.license?.en || '',
            licenceURL: font.names.licenseURL?.en || ''
        }
    };

    const json = JSON.stringify(typefaceData, null, 2);
    fs.writeFileSync(outputFile, json);

    console.log('✅ Conversion complete!');
    console.log('📝 Output file:', outputFile);
    console.log('📊 Glyphs converted:', Object.keys(glyphs).length);
});

function convertPath(path) {
    let commands = '';

    path.commands.forEach(cmd => {
        switch(cmd.type) {
            case 'M':
                commands += `M ${Math.round(cmd.x)} ${Math.round(cmd.y)} `;
                break;
            case 'L':
                commands += `L ${Math.round(cmd.x)} ${Math.round(cmd.y)} `;
                break;
            case 'Q':
                commands += `Q ${Math.round(cmd.x1)} ${Math.round(cmd.y1)} ${Math.round(cmd.x)} ${Math.round(cmd.y)} `;
                break;
            case 'C':
                commands += `C ${Math.round(cmd.x1)} ${Math.round(cmd.y1)} ${Math.round(cmd.x2)} ${Math.round(cmd.y2)} ${Math.round(cmd.x)} ${Math.round(cmd.y)} `;
                break;
            case 'Z':
                commands += 'Z ';
                break;
        }
    });

    return commands.trim();
}
