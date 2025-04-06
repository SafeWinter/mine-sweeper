import { $, $$, getId, getIJ, range } from './utils.js';
import { configs } from './config.js';

// number of mines found
let mineFound = 0; 

function bindLevelButtonActions(cfgs) {
    const btns = $$('.level [data-level]');
    btns.forEach((btn, _, arr) => {
        btn.onclick = ({
            target
        }) => {
            // toggle active class
            arr.forEach(bt => (target !== bt) ?
                bt.classList.remove('active') :
                bt.classList.add('active'));
            // reset mine found count
            mineFound = 0;
            // reload game
            start(cfgs);
        };
    });

    // when clicking on the restart button
    $('.restart').onclick = (ev) => {
        ev.preventDefault();
        start(cfgs);
        mineFound = 0; // reset mine found count
        ev.target.classList.add('hidden');
    };
}

function renderGameBoard({ row, col }) {
    const table = $('.gameBoard');
    table.innerHTML = ''; // reset table content
    const fragment = document.createDocumentFragment();
    for (let i = 1; i <= row; i++) {
        const tr = document.createElement('tr');
        for (let j = 1; j <= col; j++) {
            const td = document.createElement('td');
            td.dataset.id = `${i},${j}`;
            td.classList.add('cell');
            tr.appendChild(td);
        }
        fragment.appendChild(tr);
    }
    table.appendChild(fragment);
    return $$('.cell');
}

function generateMineCells(cfg) {
    // 1. create mine cells
    const mines = initMineCells(cfg);

    // 2. calculate neighbors for each cell
    populateNeighboringIds(mines, cfg);

    return mines;
}

function initMineCells({row, col, mine}) {
    const size = row * col; // total number of cells
    const mines = range(size)
        .sort(() => Math.random() - 0.5)
        .slice(-mine);
    // console.log(mines);
    const mineCells = range(size)
        .map(id => {
            const isMine = mines.includes(id),
                mineCount = isMine ? 9 : 0,
                neighbors = isMine ? null : []; // neighbors of the cell
            return {
                id,
                isMine,
                mineCount,
                neighbors, // neighbors of the cell
                checked: false, // whether the cell is checked or not
            };
        });
    return mineCells;
}

function populateNeighboringIds(mineCells, {col, row}) {
    // 1. Get neighbor ids for each cell
    mineCells
        .filter(({ isMine }) => !isMine)
        .forEach(cell => {
            const [i, j] = getIJ(cell.id, col);
            for (let r = Math.max(1, i - 1), rows = Math.min(row, i + 1); r <= rows; r++) {
                for (let c = Math.max(1, j - 1), cols = Math.min(col, j + 1); c <= cols; c++) {
                    if (r === i && c === j) continue;
                    const neighborId = getId(`${r},${c}`, col);
                    cell.neighbors.push(neighborId);
                }
            }
            return cell;
        });

    // 2. Calculate total number of neighboring mines
    mineCells
        .filter(({ isMine }) => !isMine)
        // get neighbor ids for each cell
        .forEach(cell => {
            const mineCount = cell.neighbors.reduce((acc, neighborId) => {
                const {isMine} = mineCells[neighborId - 1];
                return acc + (isMine ? 1 : 0);
            }, 0);
            cell.mineCount = mineCount;
            return cell;
        });

    // 3. Mark mines on the board
    // mineCells.filter(({isMine}) => isMine)
    //     .forEach(cell => {
    //         const dom = $(`.cell[data-id="${getIJ(cell.id, col)}"]`);
    //         dom.classList.add('mine', 'ms-mine');
    //     });
}

function init(cfgs) {
    // 1. Retrieve current level configuration
    const cfg = getCurrentLevel(cfgs);

    // 2. create table elements
    renderGameBoard(cfg);

    // 3. render stats info
    $('#mineCount').innerHTML = cfg.mine;
    $('#mineFound').innerHTML = mineFound;

    // 4. create mine array
    const mines = generateMineCells(cfg);

    return mines;
}

function bindEvents(cfgs, mines) {
    // when selecting a level
    bindLevelButtonActions(cfgs);

    // when clicking on the game board
    $('.gameBoard').onmousedown = (ev) => {
        ev.preventDefault();
        if(ev.target.classList.contains('gameBoard')) {
            // 禁用 table 元素上的右键菜单
            ev.target.oncontextmenu = (e) => {
                e.preventDefault();
            };
        }
    };

    // when clicking on cells
    Array.from($$('.cell')).forEach(cell => {
        cell.onmousedown = ({ target, which }) => {
            // 禁用右键菜单
            target.oncontextmenu = (e) => {
                e.preventDefault();
            };

            const cellObj = findMineCellById(target.dataset.id, cfgs, mines);

            if(cellObj.checked) {
                // already checked or flagged
                console.log('Already checked, abort');
                return; 
            }
            
            if (which === 3) {
                // 右击
                
                // 添加/删除地雷标记
                handleRightClick(target, cfgs, mines);
                
            } else if (which === 1) {
                // 左击

                // 如果已插旗，则不处理
                if (target.classList.contains('ms-flag')) {
                    console.log('Already flagged, abort');
                    return;
                }
                
                if (cellObj.isMine) {
                    // 踩雷，游戏结束：
                    showMinesAndCleanup(target, mines, cfgs);
                    // 提示重启游戏
                    setTimeout(() => {
                        $('.restart').classList.remove('hidden');
                        alert('游戏结束！你踩到地雷了！');
                    }, 0);
                    return;
                }

                // 若为安全区域，标记为已检查
                cellObj.checked = true;

                if(cellObj.mineCount > 0) {
                    // 如果不是空白单元格，则显示数字
                    target.classList.add('number', `mc-${cellObj.mineCount}`);
                    target.innerHTML = cellObj.mineCount;
                } else {
                    // 如果是空白单元格，则递归显示周围的格子
                    target.classList.add('number', 'mc-0');
                    target.innerHTML = '';
                    const colSize = getCurrentLevel(cfgs).col;
                    cellObj.neighbors.forEach(nbId => {
                        const nbCell = mines[nbId - 1];
                        const nbDom = $(`[data-id="${getIJ(nbId, colSize)}"]`);
                        if (!nbCell.checked) {
                            nbDom.dispatchEvent(new MouseEvent('mousedown', { which: 1 }));
                        }
                    });
                }

                // 查看是否胜利
                const allChecked = mines.filter(e => !e.isMine && !e.checked).length === 0;
                if (allChecked) {
                    congratulateVictory(mines, cfgs);
                }
            }
        };
    });
}

function handleRightClick(target, cfgs, mines) {
    target.classList.toggle('mine');
    target.classList.toggle('ms-flag');

    // 更新地雷标记数
    if (target.classList.contains('ms-flag')) {
        $('#mineFound').innerHTML = (++mineFound);
    } else {
        $('#mineFound').innerHTML = (--mineFound);
    }

    // 检查地雷标记数是否达到总地雷数
    const { mine: mineCount, col } = getCurrentLevel(cfgs);
    if (mineFound === mineCount) {
        // 所有地雷都已标记，检查是否正确
        const allCorrect = checkFlaggedIds(mines, col);
        if (allCorrect) {
            congratulateVictory(mines, cfgs);
        } else {
            // 不是所有地雷都已标记，游戏失败
            showMinesAndCleanup(target, mines, cfgs);
            setTimeout(() => {
                alert('地雷标记有误！再接再厉！');
                $('.restart').classList.remove('hidden');
            }, 0);
        }
    }
}

function congratulateVictory(mines, cfgs) {
    
    showFinalResult(mines, cfgs);

    setTimeout(() => {
        alert('恭喜你，成功扫除所有地雷！');
        $('.restart').classList.remove('hidden');
    }, 0);
}

function showFinalResult(mines, cfgs) {
    // 1. 渲染出所有地雷
    renderAllMines(mines, cfgs);

    // 2. 标记所有单元格为已检查（防止误操作）
    mines.forEach(mine => mine.checked = true);

    // 3. 所有标记正确的单元格背景色变为绿色
    renderAllCorrectFlagged(mines, cfgs);
}

function checkFlaggedIds(mines, col) {
    const mineIds = mines
        .filter(e => e.isMine)
        .map(e => e.id)
        .sort((a, b) => a - b)
        .join(',');
    const flaggedIds = Array.from($$('.cell.ms-flag'))
        .map(e => e.dataset.id)
        .map(ij => getId(ij, col))
        .sort((a, b) => a - b)
        .join(',');
    return (mineIds === flaggedIds);
}

function showMinesAndCleanup(target, mines, cfgs) {
    // 1. 标记当前踩雷的单元格
    target.classList.add('fail');

    // 2. 公布所有地雷
    showFinalResult(mines, cfgs);
}


function renderAllMines(mines, cfgs) {
    mines.filter(cell => cell.isMine)
        .forEach(cell => {
            const dom = findCellDomById(cell.id, cfgs);
            dom.classList.add('mine', 'ms-mine');
        });
}

function renderAllCorrectFlagged(mines, cfgs) {
    const { col } = getCurrentLevel(cfgs);
    const mineIds = mines
        .filter(e => e.isMine)
        .map(e => e.id);
    Array.from($$('.cell.ms-flag'))
        .map(e => e.dataset.id)
        .map(ij => getId(ij, col))
        .filter(id => mineIds.includes(id))
        .map(id => findCellDomById(id, cfgs))
        .forEach(dom => dom.classList.add('correct'));
}

function findCellDomById(id, cfgs) {
    const { col } = getCurrentLevel(cfgs);
    const [i, j] = getIJ(id, col);
    const dom = $(`.cell[data-id="${i},${j}"]`);
    return dom;
}

function findMineCellById(id, cfgs, mines) {
    const { col } = getCurrentLevel(cfgs);
    const index = getId(id, col) - 1;
    const cellObj = mines[index];
    return cellObj;
}

function getCurrentLevel(cfgs) {
    const btn = $('.level .active');
    const lv = btn.dataset.level || 1;
    return cfgs[`lv${lv}`];
}

function start(cfgs = configs) {
    // init game board
    const mineCells = init(cfgs);

    // bind events
    bindEvents(cfgs, mineCells);
}

start(configs);