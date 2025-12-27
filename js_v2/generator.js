class TextureGenerator {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.outputArea = document.getElementById('outputData');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.generateBtn = document.getElementById('generateBtn');
        this.fontSelect = document.getElementById('fontName');
        this.fontUpload = document.getElementById('fontUpload');

        this.padding = 1;
        this.isGenerating = false;
        this.loadedFonts = new Set(); // Для отслеживания загруженных шрифтов

        this.loadAllFonts();
        this.initializeEventListeners();
    }

    async loadAllFonts() {
        // Сохраняем текущий выбранный шрифт
        const currentFont = this.fontSelect.value;

        // Очищаем список
        this.fontSelect.innerHTML = '';

        try {
            // Добавляем Arial как первый вариант
            const arialOption = document.createElement('option');
            arialOption.value = 'Arial';
            arialOption.textContent = 'Arial';
            arialOption.style.fontFamily = 'Arial';
            this.fontSelect.appendChild(arialOption);

            // Загружаем системные шрифты (кроме Arial, который уже добавлен)
            await this.loadSystemFonts();

            // Восстанавливаем выбранный шрифт
            this.fontSelect.value = currentFont;
        } catch (error) {
            console.error('Ошибка при загрузке шрифтов:', error);
        }
    }

    async loadSystemFonts() {
        try {
            // Проверяем поддержку Local Font Access API
            if ('queryLocalFonts' in window) {
                // Получаем доступ к системным шрифтам через Local Font Access API
                const availableFonts = await window.queryLocalFonts();

                // Сортируем шрифты
                const sortedFonts = availableFonts
                    .map(font => font.family)
                    .filter(font => font !== 'Arial') // Исключаем Arial
                    .filter((value, index, self) => self.indexOf(value) === index)
                    .sort((a, b) => a.localeCompare(b, 'ru'));

                // Добавляем системные шрифты в список
                for (const fontName of sortedFonts) {
                    try {
                        const option = document.createElement('option');
                        option.value = fontName;
                        option.textContent = fontName;
                        option.style.fontFamily = fontName;
                        this.fontSelect.appendChild(option);
                    } catch (e) {
                        console.warn(`Не удалось загрузить шрифт ${fontName}:`, e);
                    }
                }
            } else {
                throw new Error('Local Font Access API не поддерживается');
            }
        } catch (error) {
            console.warn('Не удалось получить доступ к системным шрифтам:', error);

            // Если API недоступен, добавляем стандартные шрифты
            const defaultFonts = [
                'Times New Roman', 'Courier New', 'Georgia',
                'Verdana', 'Helvetica', 'Tahoma', 'Impact', 'Trebuchet MS',
                'Comic Sans MS', 'Palatino', 'Garamond', 'Bookman', 'Avant Garde'
            ];

            defaultFonts.forEach(fontName => {
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                option.style.fontFamily = fontName;
                this.fontSelect.appendChild(option);
            });
        }
    }

    initializeEventListeners() {
        this.generateBtn.addEventListener('click', () => this.generate());
        this.downloadBtn.addEventListener('click', () => this.downloadTexture());

        // Обработчик загрузки шрифтов
        this.fontUpload.addEventListener('change', (e) => this.handleFontUpload(e));

        // Обработчики для валидации ввода
        document.getElementById('fontName').addEventListener('input', (e) => this.validateFontName(e.target));
        document.getElementById('fontSize').addEventListener('input', (e) => this.validateFontSize(e.target));
        document.getElementById('distanceFieldFalloff').addEventListener('input', (e) => this.validateFalloff(e.target));

        // Обработчики для обновления состояния
        document.getElementById('charactersASCII').addEventListener('change', () => this.updateCharactersInput());
        document.getElementById('charactersCustom').addEventListener('change', () => this.updateCharactersInput());
        document.getElementById('displayTypeNormal').addEventListener('change', () => this.updateDisplayType());
        document.getElementById('displayTypeDistanceField').addEventListener('change', () => this.updateDisplayType());
    }

    validateFontName(input) {
        const isValid = this.isValidFontName(input.value);
        input.classList.toggle('error', !isValid);
        this.updateGenerateButton();
    }

    validateFontSize(input) {
        const value = parseInt(input.value);
        const isValid = value > 0 && value <= 256;
        input.classList.toggle('error', !isValid);
        this.updateGenerateButton();
    }

    validateFalloff(input) {
        const value = parseInt(input.value);
        const isValid = value > 0 && value <= 32;
        input.classList.toggle('error', !isValid);
        this.updateGenerateButton();
    }

    isValidFontName(name) {
        return document.fonts.check(`12px "${name}"`);
    }

    updateCharactersInput() {
        const customInput = document.getElementById('customCharacters');
        customInput.disabled = document.getElementById('charactersASCII').checked;
    }

    updateDisplayType() {
        const isDistanceField = document.getElementById('displayTypeDistanceField').checked;
        document.getElementById('distanceFieldOptions').style.display = isDistanceField ? 'block' : 'none';
        document.getElementById('normalOptions').style.display = isDistanceField ? 'none' : 'block';
    }

    updateGenerateButton() {
        const hasErrors = document.querySelectorAll('.error').length > 0;
        this.generateBtn.disabled = hasErrors || this.isGenerating;
    }

    async generate() {
        this.isGenerating = true;
        this.updateGenerateButton();

        try {
            const config = this.getConfiguration();
            const characters = this.getCharacters();
            const images = await this.renderCharacters(characters, config);
            const packed = this.packImages(images);

            await this.drawTexture(packed, images, config);
            this.generateOutput(packed, images, characters, config);

            this.downloadBtn.disabled = false;
        } catch (error) {
            console.error('Ошибка генерации:', error);
            alert('Произошла ошибка при генерации текстуры');
        } finally {
            this.isGenerating = false;
            this.updateGenerateButton();
        }
    }

    getConfiguration() {
        return {
            fontName: document.getElementById('fontName').value,
            fontSize: parseInt(document.getElementById('fontSize').value),
            fontScaleX: parseInt(document.getElementById('fontScaleX').value) / 100,
            fontScaleY: parseInt(document.getElementById('fontScaleY').value) / 100,
            isBold: document.getElementById('fontBold').checked,
            isItalic: document.getElementById('fontItalic').checked,
            useDistanceField: document.getElementById('displayTypeDistanceField').checked,
            usePowerOf2: document.getElementById('resolutionPowerOf2').checked,
            falloff: parseInt(document.getElementById('distanceFieldFalloff').value) || 5,
            falloff: parseInt(document.getElementById('distanceFieldFalloff').value) || 5,
            falloff: parseInt(document.getElementById('distanceFieldFalloff').value) || 5,
            distanceFieldBackground: document.getElementById('distanceFieldBackgroundBlack').checked ? 'black' : 'transparent',
            normalBackground: document.getElementById('normalBackgroundBlack').checked ? 'black' : 'transparent',
            fontColor: document.getElementById('fontColor').value,
            mirrorX: document.getElementById('mirrorX').checked,
            mirrorY: document.getElementById('mirrorY').checked
        };
    }

    getCharacters() {
        if (document.getElementById('charactersASCII').checked) {
            return Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32));
        }
        return Array.from(new Set(document.getElementById('customCharacters').value));
    }

    async renderCharacters(characters, config) {
        const images = [];
        for (const char of characters) {
            const image = await this.renderCharacter(char, config);
            images.push({
                character: char,
                ...image
            });
        }
        return images;
    }

    async renderCharacter(char, config) {
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');

        const baseSize = config.fontSize;
        const scale = config.useDistanceField ? 2 : 1;

        // Настройка шрифта для измерения с учетом масштаба
        const scaledSize = baseSize * scale;
        ctx.font = `${config.isBold ? 'bold ' : ''}${config.isItalic ? 'italic ' : ''}${scaledSize}px "${config.fontName}"`;
        const metrics = ctx.measureText(char);

        // Вычисляем базовые размеры с учетом метрик шрифта
        const padding = config.useDistanceField ? config.falloff * 2 : 4;
        const baseWidth = Math.ceil(metrics.width);

        // Используем полные метрики для определения высоты
        const ascent = Math.ceil(metrics.actualBoundingBoxAscent);
        const descent = Math.ceil(metrics.actualBoundingBoxDescent);
        const baseHeight = ascent + descent;

        // Применяем масштабирование к размерам
        const width = Math.ceil(baseWidth * config.fontScaleX) + padding;
        const height = Math.ceil(baseHeight * config.fontScaleY) + padding;

        tempCanvas.width = width;
        tempCanvas.height = height;

        // Очищаем канвас и устанавливаем фон
        if (config.useDistanceField) {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'white';
        } else {
            if (config.normalBackground === 'black') {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, width, height);
            } else {
                ctx.clearRect(0, 0, width, height);
            }
            ctx.fillStyle = config.fontColor;
        }

        // Применяем трансформацию для правильного масштабирования
        ctx.save();
        ctx.translate(padding / 2, padding / 2 + ascent * config.fontScaleY);
        ctx.scale(config.fontScaleX, config.fontScaleY);

        // Рендерим символ с учетом масштаба
        ctx.font = `${config.isBold ? 'bold ' : ''}${config.isItalic ? 'italic ' : ''}${scaledSize}px "${config.fontName}"`;
        ctx.textBaseline = 'alphabetic'; // Используем alphabetic для позиционирования
        ctx.fillText(char, 0, 0);

        ctx.restore();

        const imageData = ctx.getImageData(0, 0, width, height);

        if (config.useDistanceField) {
            const dfResult = this.convertToDistanceField(imageData, width, height, config.falloff);
            return {
                ...dfResult,
                ascent,
                padding
            };
        }

        return {
            width,
            height,
            data: imageData.data,
            advance: Math.ceil(baseWidth * config.fontScaleX),
            ascent,
            padding
        };
    }

    convertToDistanceField(imageData, width, height, falloff) {
        // массивы для хранения расстояний
        const distances = new Float32Array(width * height);
        const maxDist = falloff * 2;

        // Инициализация расстояний
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const value = imageData.data[idx]; // Значение красного канала

                // Для белых пикселей (внутри глифа) отрицательное расстояние
                // Для черных пикселей (вне глифа) положительное расстояние
                distances[y * width + x] = value > 127 ? -maxDist : maxDist;
            }
        }

        // Вычисление дистанционного поля
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x;
                let minDist = Math.abs(distances[idx]);

                // Проверяем соседние пиксели в радиусе falloff
                for (let dy = -falloff; dy <= falloff; dy++) {
                    for (let dx = -falloff; dx <= falloff; dx++) {
                        const nx = x + dx;
                        const ny = y + dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nidx = ny * width + nx;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            if (distances[idx] * distances[nidx] < 0) {
                                minDist = Math.min(minDist, dist);
                            }
                        }
                    }
                }

                // Присваиваем знак в зависимости от исходного значения
                distances[idx] = distances[idx] < 0 ? -minDist : minDist;
            }
        }

        // Нормализация и создание финального изображения
        const result = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
            const dist = distances[i];
            // Инвертируем значение для правильного отображения (белые буквы)
            const value = Math.round(255 - ((dist / maxDist) * 0.5 + 0.5) * 255);
            const idx = i * 4;

            result[idx] = result[idx + 1] = result[idx + 2] = value;
            result[idx + 3] = 255;
        }

        // Уменьшаем размер для финального результата
        const finalWidth = width >> 1;
        const finalHeight = height >> 1;
        const downsampledData = this.downsample(result, width, height);

        return {
            width: finalWidth,
            height: finalHeight,
            data: downsampledData,
            advance: finalWidth - (falloff * 2) // Учитываем padding при расчете advance
        };
    }

    downsample(data, width, height) {
        const newWidth = width >> 1;
        const newHeight = height >> 1;
        const result = new Uint8ClampedArray(newWidth * newHeight * 4);

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const i = (y * newWidth + x) * 4;
                const srcI = (y * 2 * width + x * 2) * 4;

                for (let c = 0; c < 4; c++) {
                    result[i + c] = Math.round(
                        (data[srcI + c] +
                            data[srcI + 4 + c] +
                            data[srcI + width * 4 + c] +
                            data[srcI + width * 4 + 4 + c]) / 4
                    );
                }
            }
        }

        return result;
    }

    packImages(images) {
        // Оптимизированная упаковка изображений
        const padding = this.padding * 2;
        let totalArea = 0;
        let maxWidth = 0;

        // Вычисляем общую площадь и максимальную ширину
        images.forEach(img => {
            totalArea += (img.width + padding) * (img.height + padding);
            maxWidth = Math.max(maxWidth, img.width + padding);
        });

        // Оценка оптимальной ширины текстуры
        let textureWidth = Math.max(maxWidth, Math.ceil(Math.sqrt(totalArea)));
        if (document.getElementById('resolutionPowerOf2').checked) {
            textureWidth = this.getNextPowerOfTwo(textureWidth);
        }

        // Размещаем изображения
        let currentX = this.padding;
        let currentY = this.padding;
        let rowHeight = 0;
        const positions = [];

        images.forEach(img => {
            // Проверяем, нужно ли перейти на новую строку
            if (currentX + img.width + padding > textureWidth) {
                currentX = this.padding;
                currentY += rowHeight + padding;
                rowHeight = 0;
            }

            positions.push({ x: currentX, y: currentY });

            rowHeight = Math.max(rowHeight, img.height);
            currentX += img.width + padding;
        });

        // Вычисляем финальную высоту
        let textureHeight = currentY + rowHeight + this.padding;
        if (document.getElementById('resolutionPowerOf2').checked) {
            textureHeight = this.getNextPowerOfTwo(textureHeight);
        }

        return { width: textureWidth, height: textureHeight, positions };
    }

    getNextPowerOfTwo(value) {
        let power = 1;
        while (power < value) power *= 2;
        return power;
    }

    async drawTexture(packed, images, config) {
        this.canvas.width = packed.width;
        this.canvas.height = packed.height;

        // Очищаем канвас
        if (config.useDistanceField) {
            if (config.distanceFieldBackground === 'black') {
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(0, 0, packed.width, packed.height);
            } else {
                this.ctx.clearRect(0, 0, packed.width, packed.height);
            }
        } else {
            if (config.normalBackground === 'black') {
                this.ctx.fillStyle = 'black';
                this.ctx.fillRect(0, 0, packed.width, packed.height);
            } else {
                this.ctx.clearRect(0, 0, packed.width, packed.height);
            }
            this.ctx.fillStyle = config.fontColor;
        }

        // Создаем временный канвас для нормальной отрисовки
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = packed.width;
        tempCanvas.height = packed.height;
        const tempCtx = tempCanvas.getContext('2d');

        // Заливаем фон на tempCanvas (для прозрачности это важно, но у нас putImageData)
        // putImageData игнорирует прозрачность фона tempCanvas, если мы не используем альфа-канал правильно при паковке.
        // Images data contains full RGBA.
        // Так что просто переносим пиксели.

        // Отрисовываем символы на tempCanvas
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            const pos = packed.positions[i];

            const imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
            tempCtx.putImageData(imageData, pos.x, pos.y);
        }

        // Теперь переносим с tempCanvas на this.ctx с учетом зеркалирования
        this.ctx.save();

        if (config.mirrorX) {
            this.ctx.translate(this.canvas.width, 0);
            this.ctx.scale(-1, 1);
        }

        if (config.mirrorY) {
            this.ctx.translate(0, this.canvas.height);
            this.ctx.scale(1, -1);
        }

        this.ctx.drawImage(tempCanvas, 0, 0);
        this.ctx.restore();
    }

    generateOutput(packed, images, characters, config) {
        const output = characters.map((char, i) => {
            const img = images[i];
            const pos = packed.positions[i];
            const padding = img.padding || (config.useDistanceField ? config.falloff * 2 : 4);
            const ascent = img.ascent || 0;

            // Расчет координат Vert (относительно курсора, Y вверх)
            const vertX = -(padding / 2);
            const vertY = (padding / 2) + (ascent * config.fontScaleY);

            // Расчет физических координат символа на текстуре с учетом зеркалирования
            // pos.x, pos.y - координаты Top-Left угла символа на исходном (не зеркалированном) tempCanvas.

            let pixelX = pos.x;
            let pixelY = pos.y;

            if (config.mirrorX) {
                // При зеркалировании по X, координата x переходит в Width - x.
                // Левый край символа был pos.x, ширина img.width. Правый край pos.x + img.width.
                // После зеркалирования:
                // Правый край (бывший) становится левым (новым) с координатой Width - (pos.x + img.width).
                pixelX = packed.width - (pos.x + img.width);
            }

            if (config.mirrorY) {
                // При зеркалировании по Y (переворот), y переходит в Height - y.
                // Верхний край (pos.y) переходит вниз (Height - pos.y).
                // Нижний край (pos.y + img.height) переходит вверх (Height - (pos.y + height)).
                // Таким образом, НОВЫЙ верхний край будет Height - (pos.y + img.height).
                pixelY = packed.height - (pos.y + img.height);
            }

            // Расчет UV (0,0 - Bottom-Left)
            // Y_pixel=0 (Top of Canvas) corresponds to V=1.0.
            // Y_pixel=H (Bottom of Canvas) corresponds to V=0.0.
            // Top Edge of glyph is at pixelY. V_top = 1.0 - (pixelY / H).
            // Bottom Edge of glyph is at pixelY + img.height. V_bottom = 1.0 - ((pixelY + h) / H).

            const vTopEdge = 1.0 - (pixelY / packed.height);
            const vBottomEdge = 1.0 - ((pixelY + img.height) / packed.height);

            return {
                index: char.charCodeAt(0),
                uv: {
                    x: pixelX / packed.width,
                    y: vTopEdge,
                    width: img.width / packed.width,
                    height: vBottomEdge - vTopEdge // Negative value
                },
                vert: {
                    x: vertX,
                    y: vertY,
                    width: img.width,
                    height: -img.height
                },
                advance: img.advance,
                flipped: false
            };
        });

        this.outputArea.value = JSON.stringify(output, null, 2);
    }

    downloadTexture() {
        const link = document.createElement('a');
        link.download = 'font-texture.png';
        link.href = this.canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async handleFontUpload(event) {
        const files = event.target.files;

        for (const file of files) {
            try {
                // Проверяем тип файла
                if (!file.name.match(/\.(ttf|woff|woff2|otf)$/i)) {
                    console.warn(`Файл ${file.name} не является шрифтом`);
                    continue;
                }

                // Создаем URL для файла
                const fontUrl = URL.createObjectURL(file);

                // Получаем имя шрифта из имени файла
                const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/-/g, " ");

                // Проверяем, не был ли уже загружен этот шрифт
                if (this.loadedFonts.has(fontName)) {
                    console.warn(`Шрифт ${fontName} уже загружен`);
                    continue;
                }

                // Загружаем шрифт
                const fontFace = new FontFace(fontName, `url(${fontUrl})`);
                await fontFace.load();
                document.fonts.add(fontFace);

                // Добавляем в список
                const option = document.createElement('option');
                option.value = fontName;
                option.textContent = fontName;
                option.style.fontFamily = fontName;
                this.fontSelect.appendChild(option);

                // Отмечаем как загруженный
                this.loadedFonts.add(fontName);

                // Выбираем новый шрифт
                this.fontSelect.value = fontName;

                console.log(`Шрифт ${fontName} успешно загружен`);

            } catch (error) {
                console.error(`Ошибка при загрузке шрифта ${file.name}:`, error);
            }
        }

        // Очищаем input для возможности повторной загрузки тех же файлов
        event.target.value = '';
    }
}

// Инициализация генератора при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const generator = new TextureGenerator();
    generator.updateDisplayType(); // Инициализируем видимость опций
}); 