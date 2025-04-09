import { $, $$, getId, getIJ, range } from './utils.js';
import { configs } from './config.js';

let mineFound = 0; // number of mines found
let currentLv = configs.lv1; // default level

function bindLevelButtonActions() {
    const btns = Array.from($$('.level [data-level]'));
    btns.forEach((btn, _, arr) => {
        btn.onclick = ({ target }) => {
            // toggle active class
            arr.forEach(bt => (target !== bt) ?
                bt.classList.remove('active') :
                bt.classList.add('active'));
            // reset mines found
            mineFound = 0;
            currentLv = getCurrentLevel(target.dataset.level);
            // reload game
            start(currentLv);
        };
    });

    // when clicking on the restart button
    $('.restart').onclick = (ev) => {
        ev.preventDefault();
        mineFound = 0; // reset mine found count
        start(currentLv);
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

function generateMineCells(lv, doms) {
    // 1. create mine cells
    const mines = initMineCells(lv);
    
    // 2. populate neighboring ids
    populateNeighboringIds(mines, lv, doms);
    
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
                flagged: false // whether the cell is flagged or not
            };
        });
    return mineCells;
}

function populateNeighboringIds(mineCells, {col, row}, doms) {
    const safeCells = mineCells.filter(({ isMine }) => !isMine);
    // 1. Get neighbor ids for each cell
    safeCells.forEach(cell => {
        const [i, j] = getIJ(cell.id, col);
        for (let r = Math.max(1, i - 1), rows = Math.min(row, i + 1); r <= rows; r++) {
            for (let c = Math.max(1, j - 1), cols = Math.min(col, j + 1); c <= cols; c++) {
                if (r === i && c === j) continue;
                const neighborId = getId(`${r},${c}`, col);
                cell.neighbors.push(neighborId);
            }
        }
    });

    // 2. Calculate total number of neighboring mines
    safeCells.forEach(cell => {
        // get neighbor ids for each cell
        const mineCount = cell.neighbors.reduce((acc, neighborId) => {
            const {isMine} = mineCells[neighborId - 1];
            return acc + (isMine ? 1 : 0);
        }, 0);
        cell.mineCount = mineCount;
    });
}

function init(lv) {
    // 1. create table elements
    const doms = renderGameBoard(lv);

    // 2. render stats info
    $('#mineCount').innerHTML = lv.mine;
    $('#mineFound').innerHTML = mineFound;

    // 3. create mine array
    const mines = generateMineCells(lv, doms);

    return mines;
}

function bindEvents(lv, mines) {
    // when selecting a level
    bindLevelButtonActions();

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

            const cellObj = findMineCellById(target.dataset.id, lv, mines);

            if(cellObj.checked) {
                // already checked or flagged
                console.log('Already checked, abort');
                return; 
            }
            
            if (which === 3) {
                // 右击：添加/删除地雷标记
                handleRightClick(target, lv, mines);
                
            } else if (which === 1) {
                // 左击

                // 1. 如果已插旗，则不处理
                if (cellObj.flagged) {
                    console.log('Already flagged, abort');
                    return;
                }
                
                // 2. 踩雷，游戏结束：
                if (cellObj.isMine) {
                    showMinesAndCleanup(target, mines, lv);
                    // 提示重启游戏
                    setTimeout(() => {
                        $('.restart').classList.remove('hidden');
                        alert('游戏结束！你踩到地雷了！');
                    }, 0);
                    return;
                }

                // 3. 若为安全区域，标记为已检查
                searchAround(cellObj, target, lv.col, mines);

                // 4. 查看是否胜利
                const allChecked = mines.filter(e => !e.isMine && !e.checked).length === 0;
                if (allChecked) {
                    congratulateVictory(mines, lv);
                }
            }
        };
    });
}

function searchAround(curCell, curDom, colSize, mines) {
    curCell.checked = true;

    // Render the current cell
    curDom.classList.add('number', `mc-${curCell.mineCount}`);
    curDom.innerHTML = curCell.mineCount;

    // 如果是空白单元格，则递归显示周围的格子，直到遇到非空白单元格
    if (curCell.mineCount === 0) {
        curDom.innerHTML = '';
        curCell.neighbors.forEach(nbId => {
            const nbCell = mines[nbId - 1];
            const nbDom = $(`[data-id="${getIJ(nbId, colSize)}"]`);
            if(!nbCell.checked && !nbCell.flagged && !nbCell.isMine) {
                searchAround(nbCell, nbDom, colSize, mines);
            }
        });
    }
}

function handleRightClick(target, lv, mines) {
    target.classList.toggle('mine');
    target.classList.toggle('ms-flag');
    const cellObj = findMineCellById(target.dataset.id, lv, mines);
    cellObj.flagged = !cellObj.flagged; // toggle flagged status

    // 更新地雷标记数
    if (cellObj.flagged) {
        $('#mineFound').innerHTML = (++mineFound);
    } else {
        $('#mineFound').innerHTML = (--mineFound);
    }
}

function congratulateVictory(mines, lv) {

    showFinalResult(mines, lv);
    
    setTimeout(() => {
        alert('恭喜你，成功扫除所有地雷！');
        $('.restart').classList.remove('hidden');
    }, 0);
}

function showFinalResult(mines, lv) {
    // 1. 渲染出所有地雷
    renderAllMines(mines, lv.col);

    // 2. 标记所有单元格为已检查（防止误操作）
    mines.forEach(mine => mine.checked = true);

    // 3. 所有标记正确的单元格背景色变为绿色
    renderAllCorrectFlagged(mines, lv);
}

function showMinesAndCleanup(target, mines, lv) {
    // 1. 标记当前踩雷的单元格
    target.classList.add('fail');

    // 2. 公布所有地雷
    showFinalResult(mines, lv);
}


function renderAllMines(mines, col) {
    mines.filter(cell => cell.isMine)
        .forEach(({id}) => findCellDomById(id, col)
            .classList.add('mine', 'ms-mine'));
}

function renderAllCorrectFlagged(mines, lv) {
    const { col } = lv;
    const mineIds = mines
        .filter(e => e.isMine)
        .map(e => e.id);
    Array.from($$('.cell.ms-flag'))
        .map(e => e.dataset.id)
        .map(ij => getId(ij, col))
        .forEach(id => {
            const dom = findCellDomById(id, col);
            const targetClass = mineIds.includes(id) ? 'correct' : 'fail';
            dom.classList.add(targetClass);
        });
}

function findCellDomById(id, col) {
    const ij = getIJ(id, col).join(',');
    return $(`.cell[data-id="${ij}"]`);
}

function findMineCellById(id, {col}, mines) {
    const index = getId(id, col) - 1;
    return mines[index];
}

function getCurrentLevel(lv, cfgs = configs) {
    return cfgs[`lv${lv}`];
}

function start(lv = currentLv) {
    // init game board
    const mineCells = init(lv);

    // bind events
    bindEvents(lv, mineCells);
}

start(currentLv);