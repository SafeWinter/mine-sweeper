import { $, $$, getId, getIJ, range } from './utils.js';
import { configs } from './config.js';

// number of mines found
let mineFound = 0; 
let currentLv = configs.lv1; // default level

function bindLevelButtonActions() {
    const btns = Array.from($$('.level [data-level]'));
    btns.forEach((btn, _, arr) => {
        btn.onclick = ({ target }) => {
            // toggle active class
            arr.forEach(bt => (target !== bt) ?
                bt.classList.remove('active') :
                bt.classList.add('active'));
            // reset mine found count
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
    let mines = initMineCells(lv);
    let needRefresh = populateNeighboringIds(mines, lv, doms);
    
    // 2. check if the mine distribution is valid
    let i = 0, limit = 10;
    while(needRefresh && i < limit) {
        mines = initMineCells(lv);
        needRefresh = populateNeighboringIds(mines, lv, doms);
        i++;
    }
    
    if(i === limit) {
        alert('地雷分布无法满足条件，请检查配置参数！');
        throw new Error('地雷分布无法满足条件，请检查配置参数！');
    } else if (i > 0) {
        console.log('地雷分布已重新生成，累计迭代次数：', i);
    }

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

            // const dom = $(`.cell[data-id="${getIJ(cell.id, col)}"]`);
            // dom.classList.add('number', `mc-${mineCount}`);
            // dom.innerHTML = mineCount > 0 ? mineCount : '';
        });

    // 3. Mark mines on the board
    // mineCells.filter(({isMine}) => isMine)
    //     .forEach(cell => {
    //         const dom = $(`.cell[data-id="${getIJ(cell.id, col)}"]`);
    //         dom.classList.add('mine', 'ms-mine');
    //     });

    // 4. Check if the mine distribution is valid
    const needRefresh = checkInvalidCorner(mineCells, col);
    
    return needRefresh;
}

// Check if the mine distribution is valid
function checkInvalidCorner(mineCells, col, /* doms */) {
    // Array.from(doms)
    //     .filter(dom => dom.classList.contains('invalid'))
    //     .forEach(dom => {
    //         dom.classList.remove('invalid');
    //     });
    const coordinates = mineCells.filter(({ isMine, mineCount }) => !isMine && mineCount === 0)
        .reduce((acc, cell) => {
            const { id, neighbors } = cell, 
                idLeft = id - 1, 
                idRight = id + 1, 
                idTop = id - col, 
                idBottom = id + col;

            const cornerChecker = checkCorner(neighbors, mineCells, col);
            const [foundTL, ij1] = cornerChecker([idTop, idLeft], arr => Math.min(...arr) - 1 - 1);
            const [foundTR, ij2] = cornerChecker([idTop, idRight], arr => Math.min(...arr) + 1 - 1);
            const [foundBL, ij3] = cornerChecker([idBottom, idLeft], arr => Math.max(...arr) - 1 - 1);
            const [foundBR, ij4] = cornerChecker([idBottom, idRight], arr => Math.max(...arr) + 1 - 1);
            if (foundTL || foundTR || foundBL || foundBR) {
                const coordinates = [ij1, ij2, ij3, ij4]
                    .filter(Boolean)
                    .map(c => `(${c})`);
                acc.push(...coordinates);
            }
            return acc;
        }, []);

    const needRefresh = coordinates.length > 0;
    if (needRefresh) {
        console.log(`检测到边界未完全封闭(坐标：${coordinates.join(',')})，需要重新生成地雷分布！`);
    }
    return needRefresh;
}

function checkCorner(neighbors, mineCells, col) {
    return (group, indexCb) => {
        const nbs = neighbors.filter(nb => group.includes(nb));
        const inPair = nbs.length === 2;
        if (!inPair) {
            return [false];
        }

        const bothNearMine = nbs.every(nbId => {
            const target = mineCells[nbId - 1];
            return (!!target) && (target.mineCount > 0);
        });
        if(!bothNearMine) {
            return [false];
        }

        // 检查：左上角单元格存在且 mineCount > 0
        const cornerIndex = indexCb(nbs);
        const cornerCell = mineCells[cornerIndex];
        const invalid = (!!cornerCell) && cornerCell.mineCount === 0;

        if(!invalid) {
            // 为有效单元格，跳过
            return [false];
        }

        const ij = getIJ(cornerCell.id, col);
        // // 标记为无效单元格（需要新增参数 cell）
        // [cornerCell, cell].forEach(c => {
        //     const dom = $(`.cell[data-id="${getIJ(c.id, col)}"]`);
        //     dom.classList.add('invalid');
        // });
        return [invalid, ij];
    };
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

            const cellObj = findMineCellById(target.dataset.id, mines);

            if(cellObj.checked) {
                // already checked or flagged
                console.log('Already checked, abort');
                return; 
            }
            
            if (which === 3) {
                // 右击
                
                // 添加/删除地雷标记
                handleRightClick(target, lv, mines);
                
            } else if (which === 1) {
                // 左击

                // 如果已插旗，则不处理
                if (cellObj.flagged) {
                    console.log('Already flagged, abort');
                    return;
                }
                
                if (cellObj.isMine) {
                    // 踩雷，游戏结束：
                    showMinesAndCleanup(target, mines, lv);
                    // 提示重启游戏
                    setTimeout(() => {
                        $('.restart').classList.remove('hidden');
                        alert('游戏结束！你踩到地雷了！');
                    }, 0);
                    return;
                }

                // 若为安全区域，标记为已检查
                searchAround(cellObj, target, lv.col, mines);

                // 查看是否胜利
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
    const cellObj = findMineCellById(target.dataset.id, mines);
    cellObj.flagged = !cellObj.flagged; // toggle flagged status

    // 更新地雷标记数
    if (cellObj.flagged) {
        $('#mineFound').innerHTML = (++mineFound);
    } else {
        $('#mineFound').innerHTML = (--mineFound);
    }

    // 检查地雷标记数是否达到总地雷数
    const { mine: mineCount, col } = lv;
    if (mineFound === mineCount) {
        // 所有地雷都已标记，检查是否正确
        const allCorrect = checkFlaggedIds(mines, col);
        if (allCorrect) {
            congratulateVictory(mines, lv);
        } else {
            // 不是所有地雷都已标记，游戏失败
            showMinesAndCleanup(target, mines, lv);
            setTimeout(() => {
                alert('地雷标记有误！再接再厉！');
                $('.restart').classList.remove('hidden');
            }, 0);
        }
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
    renderAllMines(mines, lv);

    // 2. 标记所有单元格为已检查（防止误操作）
    mines.forEach(mine => mine.checked = true);

    // 3. 所有标记正确的单元格背景色变为绿色
    renderAllCorrectFlagged(mines, lv);
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

function showMinesAndCleanup(target, mines, lv) {
    // 1. 标记当前踩雷的单元格
    target.classList.add('fail');

    // 2. 公布所有地雷
    showFinalResult(mines, lv);
}


function renderAllMines(mines, lv) {
    mines.filter(cell => cell.isMine)
        .forEach(cell => {
            const dom = findCellDomById(cell.id, lv);
            dom.classList.add('mine', 'ms-mine');
        });
}

function renderAllCorrectFlagged(mines, lv) {
    const { col } = currentLv;
    const mineIds = mines
        .filter(e => e.isMine)
        .map(e => e.id);
    Array.from($$('.cell.ms-flag'))
        .map(e => e.dataset.id)
        .map(ij => getId(ij, col))
        .filter(id => mineIds.includes(id))
        .map(id => findCellDomById(id, lv))
        .forEach(dom => dom.classList.add('correct'));
}

function findCellDomById(id, { col }) {
    const [i, j] = getIJ(id, col);
    const dom = $(`.cell[data-id="${i},${j}"]`);
    return dom;
}

function findMineCellById(id, mines) {
    const { col } = currentLv;
    const index = getId(id, col) - 1;
    const cellObj = mines[index];
    return cellObj;
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