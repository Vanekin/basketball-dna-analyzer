const STORAGE_KEY = 'basketballDNAResults';

class BasketballDNAAnalyzer {
    constructor() {
        this.playersData = [];
        this.currentResult = null;
        this.init();
    }

    async init() {
        this.bindEvents();
        try {
            await this.waitForNBAData();
        } catch (error) {
            console.error('Данные игроков не загрузились:', error);
            alert('Ошибка загрузки данных NBA. Приложение не сможет работать.');
        }
        this.loadHistory();
    }

    waitForNBAData() {
        return new Promise((resolve, reject) => {
            const maxAttempts = 10;
            let attempts = 0;
            const checkData = () => {
                attempts++;
                if (window.NBA_PLAYERS_DATA && Array.isArray(window.NBA_PLAYERS_DATA)) {
                    this.playersData = window.NBA_PLAYERS_DATA;
                    resolve();
                    return;
                }
                if (attempts >= maxAttempts) {
                    reject('Данные не загрузились');
                    return;
                }
                setTimeout(checkData, 500);
            };
            checkData();
        });
    }

    bindEvents() {
        const playerForm = document.getElementById('playerForm');
        if (playerForm) playerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAnalysis();
        });

        const heightSlider = document.getElementById('height');
        if (heightSlider) {
            heightSlider.addEventListener('input', (e) => {
                document.getElementById('heightValue').textContent = e.target.value + ' см';
            });
            document.getElementById('heightValue').textContent = heightSlider.value + ' см';
        }

        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentResult());

        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        const newAnalysisBtn = document.getElementById('newAnalysisBtn');
        if (newAnalysisBtn) newAnalysisBtn.addEventListener('click', () => this.showInputSection());
    }

    handleAnalysis() {
        if (this.playersData.length === 0) {
            alert('Нет данных игроков для анализа');
            return;
        }

        const userData = this.collectUserData();
        this.showLoading(true);

        this.simulateDNAAnalysis(userData)
            .then(result => {
                this.currentResult = result;
                this.displayResult(result);
                this.showLoading(false);
            })
            .catch(error => {
                console.error('Ошибка:', error);
                alert('Ошибка анализа');
                this.showLoading(false);
            });
    }

    simulateDNAAnalysis(userData) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                const topMatch = this.findClosestMatch(userData);
                if (topMatch) {
                    resolve({
                        userData,
                        topMatch,
                        matchPercentage: topMatch.similarityScore,
                        comparisonDate: new Date().toLocaleString('ru-RU')
                    });
                } else {
                    reject('Нет совпадений');
                }
            }, 1500);
        });
    }

    findClosestMatch(userData) {
        let bestMatch = null;
        let highestScore = -1;

        const userHeight = userData.height;
        const userPos = userData.position;
        const userStyles = userData.styles || [];

        for (const player of this.playersData) {
            const playerHeightCm = this.convertHeightToCm(player.height_feet, player.height_inches);
            const heightDiff = Math.abs(userHeight - playerHeightCm);

            if (heightDiff > 15) continue;

            let heightScore = Math.max(0, 100 - heightDiff * 6);
            if (heightDiff <= 3) heightScore += 25;

            let positionScore = 0;
            const playerPos = player.position || 'G';
            if (userPos === playerPos) {
                positionScore = 100;
            } else {
                const compat = {
                    'G': ['G-F', 'F-G'],
                    'F': ['G-F', 'F-G', 'F-C', 'C-F'],
                    'C': ['F-C', 'C-F']
                };
                if (compat[userPos]?.includes(playerPos)) positionScore = 70;
                else positionScore = 20;
            }

            let styleScore = 0;
            if (userStyles.length > 0) {
                const matched = this.countMatchingStyles(userStyles, playerPos);
                styleScore = (matched / userStyles.length) * 100;
            } else {
                styleScore = 80;
            }

            const totalScore = (heightScore * 0.35) + (positionScore * 0.15) + (styleScore * 0.50);

            if (totalScore > highestScore) {
                highestScore = totalScore;
                bestMatch = {
                    ...player,
                    similarityScore: Math.round(totalScore),
                    height_cm: playerHeightCm
                };
            }
        }

        return bestMatch;
    }

    countMatchingStyles(userStyles, playerPos) {
        const stylesByPosition = {
            'G': ['shooter', 'playmaker'],
            'F': ['shooter', 'defender', 'rebounder'],
            'C': ['defender', 'rebounder'],
            'G-F': ['shooter', 'playmaker', 'defender'],
            'F-G': ['shooter', 'playmaker', 'defender'],
            'F-C': ['defender', 'rebounder', 'shooter'],
            'C-F': ['defender', 'rebounder', 'shooter']
        };

        const compatible = stylesByPosition[playerPos] || [];
        return userStyles.filter(style => compatible.includes(style)).length;
    }

    convertHeightToCm(feet, inches) {
        return (feet * 30.48) + (inches * 2.54);
    }

    collectUserData() {
        const height = parseInt(document.getElementById('height').value) || 180;
        const position = document.getElementById('position').value || 'G';
        const styles = Array.from(document.querySelectorAll('input[name="styles"]:checked'))
            .map(cb => cb.value);

        return { height, position, styles };
    }

    saveCurrentResult() {
        if (!this.currentResult) return alert('Нет результата для сохранения');

        const results = this.getSavedResults();
        results.unshift({
            id: Date.now(),
            ...this.currentResult,
            savedAt: new Date().toISOString()
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
        this.loadHistory();
    }

    getSavedResults() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    loadHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        const results = this.getSavedResults();
        if (results.length === 0) {
            historyList.innerHTML = '<p>История пуста</p>';
            return;
        }

        historyList.innerHTML = results.slice(0, 5).map(r => `
            <div>
                <strong>${r.topMatch.first_name} ${r.topMatch.last_name}</strong> (${r.matchPercentage}%)
                <br><small>${r.comparisonDate}</small>
            </div>
        `).join('');
    }

    clearHistory() {
        if (confirm('Очистить историю?')) {
            localStorage.removeItem(STORAGE_KEY);
            this.loadHistory();
        }
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        const results = document.getElementById('matchResult');
        if (loading) loading.classList.toggle('hidden', !show);
        if (results && show) results.innerHTML = '';
        if (show) this.showResultsSection();
    }

    displayResult(result) {
        const matchResult = document.getElementById('matchResult');
        if (!matchResult) return;

        const heightCm = this.convertHeightToCm(result.topMatch.height_feet, result.topMatch.height_inches);
        const weightKg = (result.topMatch.weight_pounds * 0.453592).toFixed(1);

        const heightDiff = Math.abs(result.userData.height - heightCm).toFixed(1);

        matchResult.innerHTML = `
            <div class="match-card">
                <h3>Ваш двойник: ${result.topMatch.first_name} ${result.topMatch.last_name}</h3>
                <p>${result.matchPercentage}% совпадения</p>
                <p>Команда: ${result.topMatch.team?.full_name || 'Не указана'}</p>
                <p>Рост: ${result.topMatch.height_feet}'${result.topMatch.height_inches}" (${heightCm.toFixed(1)} см)</p>
                <p>Вес: ${result.topMatch.weight_pounds} lbs (${weightKg} кг)</p>
                <p>Позиция: ${this.getPositionName(result.topMatch.position)}</p>
                <p>Разница в росте: ${heightDiff} см</p>
                <p>Стили: ${this.countMatchingStyles(result.userData.styles, result.topMatch.position)} из ${result.userData.styles.length}</p>
            </div>
        `;
    }

    getPositionName(code) {
        const positions = {
            'G': 'Защитник',
            'F': 'Форвард',
            'C': 'Центровой',
            'G-F': 'Защитник-Форвард',
            'F-C': 'Форвард-Центровой',
            'F-G': 'Форвард-Защитник',
            'C-F': 'Центровой-Форвард'
        };
        return positions[code] || code;
    }

    showInputSection() {
        document.getElementById('inputSection').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }

    showResultsSection() {
        document.getElementById('inputSection').classList.add('hidden');
        document.getElementById('resultsSection').classList.remove('hidden');
    }
}

window.addEventListener('load', () => new BasketballDNAAnalyzer());