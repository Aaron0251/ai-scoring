const prisma = require('../prisma');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getAccessibleDeptIds } = require('../utils/accessControl');

// 生產環境隱藏內部錯誤細節，開發環境保留完整訊息
function safeError(res, err, status = 500) {
  const isProd = process.env.NODE_ENV === 'production';
  console.error('[ResourceLibrary]', err);
  res.status(status).json({ error: isProd ? '伺服器發生錯誤，請稍後再試' : err.message });
}

// 舊資料相容用：early 版本檔案曾存於此磁碟目錄（Cloud Run 暫時磁碟，重啟即失）
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/resources');

// Multer 設定（資源檔案，最大 20MB）——改用記憶體儲存，檔案內容寫入資料庫，
// 不再落地暫時磁碟，避免容器重啟後檔案遺失。
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/webm', 'video/ogg',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('僅接受 PDF、Excel、影片或圖片檔案'));
  },
});
exports.uploadMiddleware = upload.single('file');

// ─────────────────────────────────────────────
// 分類 (ResourceCategory)
// ─────────────────────────────────────────────

exports.getCategories = async (req, res) => {
  try {
    const { divisionId, departmentId, sectionId } = req.query;
    const where = { active: true };

    if (sectionId) {
      // 課別層：精確匹配課別
      where.sectionId = parseInt(sectionId);
    } else if (departmentId) {
      // 部門層：精確匹配部門
      where.departmentId = parseInt(departmentId);
    } else if (divisionId) {
      // 本部層：包含直屬本部 + 所有下屬部門 + 下屬課別
      const divId = parseInt(divisionId);
      const depts = await prisma.department.findMany({
        where: { divisionId: divId },
        select: { id: true },
      });
      const deptIds = depts.map(d => d.id);
      const sects = deptIds.length
        ? await prisma.section.findMany({ where: { departmentId: { in: deptIds } }, select: { id: true } })
        : [];
      const sectIds = sects.map(s => s.id);

      const orClauses = [{ divisionId: divId }];
      if (deptIds.length) orClauses.push({ departmentId: { in: deptIds } });
      if (sectIds.length) orClauses.push({ sectionId:    { in: sectIds } });
      where.OR = orClauses;
    }

    const categories = await prisma.resourceCategory.findMany({
      where,
      include: {
        division:   { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        section:    { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(categories);
  } catch (err) {
    safeError(res, err);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, sortOrder, divisionId } = req.body;
    if (!name)       return res.status(400).json({ error: '請填寫分類名稱' });
    if (!divisionId) return res.status(400).json({ error: '請選擇本部' });

    const cat = await prisma.resourceCategory.create({
      data: {
        name,
        sortOrder:    sortOrder != null ? parseInt(sortOrder) : 0,
        divisionId:   parseInt(divisionId),
        departmentId: null,
        sectionId:    null,
      },
      include: { division: { select: { id: true, name: true } } },
    });
    res.status(201).json(cat);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: '此本部已有相同名稱的分類' });
    safeError(res, err);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, sortOrder, active } = req.body;
    const cat = await prisma.resourceCategory.update({
      where: { id },
      data: { name, description, sortOrder, active },
      include: { department: { select: { id: true, name: true } } },
    });
    res.json(cat);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '找不到分類' });
    safeError(res, err);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.resourceCategory.update({ where: { id }, data: { active: false } });
    res.json({ message: '已刪除' });
  } catch (err) {
    safeError(res, err);
  }
};

// ─────────────────────────────────────────────
// 工具卡片 (ResourceTool)
// ─────────────────────────────────────────────

exports.getTools = async (req, res) => {
  try {
    const { categoryId, departmentId } = req.query;
    const where = { active: true };
    if (categoryId) where.categoryId = parseInt(categoryId);
    if (departmentId) where.departmentId = parseInt(departmentId);

    const tools = await prisma.resourceTool.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        items: { where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(tools);
  } catch (err) {
    safeError(res, err);
  }
};

exports.getToolsGrouped = async (req, res) => {
  try {
    const userId = req.user?.id;

    // 共用的 tool include 欄位
    const toolInclude = {
      division:   { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      section:    { select: { id: true, name: true } },
      scene:      { select: { id: true, itemNo: true, agentCategory: true, developMethod: true, taskOwners: true, seedOwners: true } },
      items: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      },
    };

    // 取得所有本部（含排序）
    const divisions = await prisma.division.findMany({ orderBy: { id: 'asc' } });

    // 取得所有部門（含 divisionId）用於推算本部
    const departments = await prisma.department.findMany({ select: { id: true, divisionId: true } });
    const deptDivMap = Object.fromEntries(departments.map(d => [d.id, d.divisionId]));

    // 取得未分類工具（categoryId 為 null）
    const uncategorizedTools = await prisma.resourceTool.findMany({
      where: { active: true, categoryId: null },
      include: toolInclude,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    // 取得有分類的工具（透過分類分組）
    const categories = await prisma.resourceCategory.findMany({
      where: { active: true },
      include: {
        division:   { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        section:    { select: { id: true, name: true } },
        tools: {
          where: { active: true, categoryId: { not: null } },
          include: toolInclude,
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    // 取得使用者最愛
    let favoriteToolIds = new Set();
    if (userId) {
      const favs = await prisma.userFavorite.findMany({ where: { userId }, select: { toolId: true } });
      favoriteToolIds = new Set(favs.map(f => f.toolId));
    }

    const addFav = (tool) => ({ ...tool, isFavorite: favoriteToolIds.has(tool.id) });

    // 計算每個分類的有效本部 ID
    const catsWithFav = categories.map(cat => {
      const effDivId = cat.divisionId || (cat.departmentId ? deptDivMap[cat.departmentId] : null);
      return {
        ...cat,
        _divisionId: effDivId,
        tools: cat.tools.map(addFav),
      };
    });

    // 未分類工具按本部分組
    const uncatByDiv = {};
    for (const tool of uncategorizedTools) {
      const divId = tool.divisionId || (tool.departmentId ? deptDivMap[tool.departmentId] : null);
      const key = divId ?? 0;
      if (!uncatByDiv[key]) uncatByDiv[key] = [];
      uncatByDiv[key].push(addFav(tool));
    }

    // 依本部分組
    const result = divisions.map(div => {
      const divCats = catsWithFav
        .filter(cat => cat._divisionId === div.id && cat.tools.length > 0)
        .map(({ _divisionId, ...cat }) => cat);
      const uncatTools = uncatByDiv[div.id] || [];
      if (!divCats.length && !uncatTools.length) return null;
      return {
        id: div.id,
        name: div.name,
        uncategorized: uncatTools,
        categories: divCats,
        totalTools: uncatTools.length + divCats.reduce((sum, c) => sum + c.tools.length, 0),
      };
    }).filter(Boolean);

    // 無法對應本部的工具歸到「其他」
    const orphanCats = catsWithFav
      .filter(cat => !cat._divisionId && cat.tools.length > 0)
      .map(({ _divisionId, ...cat }) => cat);
    const orphanUncat = uncatByDiv[0] || [];
    if (orphanCats.length || orphanUncat.length) {
      result.push({
        id: 0, name: '其他',
        uncategorized: orphanUncat,
        categories: orphanCats,
        totalTools: orphanUncat.length + orphanCats.reduce((sum, c) => sum + c.tools.length, 0),
      });
    }

    res.json(result);
  } catch (err) {
    safeError(res, err);
  }
};

exports.createTool = async (req, res) => {
  try {
    const { name, description, categoryId, divisionId, departmentId, sectionId, sortOrder } = req.body;
    if (!name) return res.status(400).json({ error: '請填寫工具名稱' });
    // categoryId 為可選，不填則放入未分類

    const tool = await prisma.resourceTool.create({
      data: {
        name,
        description,
        categoryId:   categoryId ? parseInt(categoryId) : null,
        divisionId:   divisionId   ? parseInt(divisionId)   : null,
        departmentId: departmentId ? parseInt(departmentId) : null,
        sectionId:    sectionId    ? parseInt(sectionId)    : null,
        sortOrder: sortOrder ?? 0,
        createdBy: req.user.username,
      },
      include: {
        category:   { select: { id: true, name: true } },
        division:   { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        section:    { select: { id: true, name: true } },
        items: true,
      },
    });
    res.status(201).json(tool);
  } catch (err) {
    safeError(res, err);
  }
};

exports.updateTool = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, description, categoryId, departmentId, sortOrder, active } = req.body;
    const tool = await prisma.resourceTool.update({
      where: { id },
      data: {
        name,
        description,
        categoryId: categoryId ? parseInt(categoryId) : undefined,
        departmentId: departmentId !== undefined ? (departmentId ? parseInt(departmentId) : null) : undefined,
        sortOrder,
        active,
      },
      include: {
        category: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        items: { where: { active: true } },
      },
    });
    res.json(tool);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '找不到工具' });
    safeError(res, err);
  }
};

exports.deleteTool = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.resourceTool.update({ where: { id }, data: { active: false } });
    res.json({ message: '已刪除' });
  } catch (err) {
    safeError(res, err);
  }
};

// ─────────────────────────────────────────────
// 資源項目 (ResourceItem)
// ─────────────────────────────────────────────

exports.createItem = async (req, res) => {
  try {
    const toolId = parseInt(req.params.toolId);
    const { name, itemType, url, description, sortOrder } = req.body;

    if (!name) return res.status(400).json({ error: '請填寫項目名稱' });
    if (!itemType) return res.status(400).json({ error: '請選擇項目類型' });

    let filePath = null, fileData = null, fileSize = null, mimeType = null;

    const isUrlType = itemType === 'url' || itemType === 'video_url';
    if (isUrlType) {
      if (!url) return res.status(400).json({ error: '請填寫連結網址' });
    } else {
      // 檔案上傳（記憶體 buffer → 存入資料庫）
      if (req.file) {
        const ext  = path.extname(req.file.originalname);
        const base = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9一-鿿_-]/g, '_');
        filePath = `${Date.now()}_${base}${ext}`;  // 檔名（含副檔名），供下載命名
        fileData = req.file.buffer;                 // 檔案內容存資料庫
        fileSize = req.file.size;
        mimeType = req.file.mimetype;
      }
    }

    const item = await prisma.resourceItem.create({
      data: {
        toolId,
        name,
        itemType,
        url: isUrlType ? url : null,
        filePath,
        fileData,
        fileSize,
        mimeType,
        description,
        sortOrder: sortOrder ?? 0,
        createdBy: req.user.username,
      },
    });
    res.status(201).json(item);
  } catch (err) {
    safeError(res, err);
  }
};

exports.updateItem = async (req, res) => {
  try {
    const id = parseInt(req.params.itemId);
    const { name, url, description, sortOrder, active } = req.body;

    const item = await prisma.resourceItem.update({
      where: { id },
      data: { name, url, description, sortOrder, active },
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '找不到項目' });
    safeError(res, err);
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const id = parseInt(req.params.itemId);
    const item = await prisma.resourceItem.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ error: '找不到項目' });

    // 軟刪除
    await prisma.resourceItem.update({ where: { id }, data: { active: false } });

    // 若有實體檔案可選擇性刪除（此處保留，避免誤刪）
    res.json({ message: '已刪除' });
  } catch (err) {
    safeError(res, err);
  }
};

// 提供上傳檔案下載/預覽（支援 query token 供新分頁開啟）
exports.serveFile = async (req, res) => {
  try {
    // 支援 ?token=xxx 方式（新分頁下載場景）
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '未授權' });
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Token 無效' }); }

    const id = parseInt(req.params.itemId);
    // 明確 omit:false 取回 fileData（全域預設不撈）
    const item = await prisma.resourceItem.findUnique({ where: { id }, omit: { fileData: false } });
    if (!item || !item.filePath) return res.status(404).json({ error: '找不到檔案' });

    // 從儲存的檔名取出副檔名，附加到下載檔名
    const ext = path.extname(item.filePath);  // e.g. ".xlsx"
    const downloadName = item.name.endsWith(ext) ? item.name : item.name + ext;

    // PDF 用 inline（可預覽），其餘用 attachment（強制下載）
    const disposition = item.mimeType === 'application/pdf' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
    if (item.mimeType) res.setHeader('Content-Type', item.mimeType);

    // 主要：從資料庫讀取檔案內容
    if (item.fileData) {
      return res.send(Buffer.from(item.fileData));
    }

    // 相容：舊資料若仍有實體磁碟檔則回退（正式環境暫時磁碟通常已清空）
    const diskPath = path.join(UPLOAD_DIR, item.filePath);
    if (fs.existsSync(diskPath)) return res.sendFile(diskPath);

    return res.status(404).json({ error: '檔案不存在' });
  } catch (err) {
    safeError(res, err);
  }
};

// ─────────────────────────────────────────────
// 場景成果（已完成場景自動納入）
// ─────────────────────────────────────────────

exports.getSceneGrouped = async (req, res) => {
  try {
    const { divisionId, departmentId, sectionId, keyword } = req.query;
    const allowedDeptIds = await getAccessibleDeptIds(req.user);

    const where = { status: '已完成', active: true };
    if (allowedDeptIds !== null) where.departmentId = { in: allowedDeptIds };

    if (departmentId) {
      const reqDeptId = parseInt(departmentId);
      if (allowedDeptIds !== null && !allowedDeptIds.includes(reqDeptId)) return res.json([]);
      where.departmentId = reqDeptId;
    } else if (divisionId) {
      const divDepts = await prisma.department.findMany({
        where: { divisionId: parseInt(divisionId) }, select: { id: true },
      });
      const divDeptIds = divDepts.map(d => d.id);
      const effectiveIds = allowedDeptIds !== null
        ? divDeptIds.filter(id => allowedDeptIds.includes(id))
        : divDeptIds;
      where.departmentId = { in: effectiveIds };
    }
    if (sectionId) where.sectionId = parseInt(sectionId);
    if (keyword)   where.OR = [
      { sceneName: { contains: keyword } },
      { itemNo:    { contains: keyword } },
    ];

    const scenes = await prisma.scene.findMany({
      where,
      include: {
        department:       { include: { division: true } },
        section:          true,
        resourceCategory: { select: { id: true, name: true } },
      },
      orderBy: { itemNo: 'asc' },
    });

    // 依本部分組：未分類優先，已分類後跟
    const divMap = new Map();
    for (const s of scenes) {
      const div = s.department.division;
      if (!divMap.has(div.id)) {
        divMap.set(div.id, { id: div.id, name: div.name, uncategorized: [], categories: new Map() });
      }
      const divGroup = divMap.get(div.id);
      const card = {
        id:                 s.id,
        itemNo:             s.itemNo,
        sceneName:          s.sceneName,
        developMethod:      s.developMethod,
        taskOwners:         s.taskOwners,
        seedOwners:         s.seedOwners,
        goLiveDate:         s.goLiveDate,
        savingHoursMonthly: s.savingHoursMonthly,
        resourceCategoryId: s.resourceCategoryId,
        division:  { id: div.id, name: div.name },
        department: { id: s.department.id, name: s.department.name },
        section:    s.section ? { id: s.section.id, name: s.section.name } : null,
      };

      if (!s.resourceCategoryId) {
        divGroup.uncategorized.push(card);
      } else {
        const cat = s.resourceCategory;
        if (!divGroup.categories.has(cat.id)) {
          divGroup.categories.set(cat.id, { id: cat.id, name: cat.name, scenes: [] });
        }
        divGroup.categories.get(cat.id).scenes.push(card);
      }
    }

    const result = Array.from(divMap.values()).map(div => ({
      id:          div.id,
      name:        div.name,
      uncategorized: div.uncategorized,
      categories:  Array.from(div.categories.values()),
      totalScenes: div.uncategorized.length +
        Array.from(div.categories.values()).reduce((sum, c) => sum + c.scenes.length, 0),
    }));
    result.sort((a, b) => a.name.localeCompare(b.name, 'zh'));

    res.json(result);
  } catch (err) {
    safeError(res, err);
  }
};

exports.assignSceneCategory = async (req, res) => {
  try {
    const sceneId = parseInt(req.params.sceneId);
    const { categoryId } = req.body;
    await prisma.scene.update({
      where: { id: sceneId },
      data: { resourceCategoryId: categoryId ? parseInt(categoryId) : null },
    });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '找不到場景' });
    safeError(res, err);
  }
};

// ─────────────────────────────────────────────
// 個人最愛 (UserFavorite)
// ─────────────────────────────────────────────

exports.getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;
    const favorites = await prisma.userFavorite.findMany({
      where: { userId },
      include: {
        tool: {
          select: {
            id: true,
            name: true,
            description: true,
            items: {
              where: { active: true, itemType: 'url' },
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
      orderBy: [{ folderName: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
    });
    res.json(favorites);
  } catch (err) {
    safeError(res, err);
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const toolId = parseInt(req.params.toolId);
    const { folderName } = req.body;

    // 確認工具有網址項目
    const urlItem = await prisma.resourceItem.findFirst({
      where: { toolId, itemType: 'url', active: true },
    });
    if (!urlItem) {
      return res.status(400).json({ error: '此工具卡片沒有網址連結，無法加入最愛' });
    }

    const fav = await prisma.userFavorite.create({
      data: { userId, toolId, folderName: folderName || null },
    });
    res.status(201).json(fav);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: '已在最愛清單中' });
    safeError(res, err);
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const toolId = parseInt(req.params.toolId);
    await prisma.userFavorite.deleteMany({ where: { userId, toolId } });
    res.json({ message: '已從最愛移除' });
  } catch (err) {
    safeError(res, err);
  }
};

exports.updateFavoriteFolder = async (req, res) => {
  try {
    const userId = req.user.id;
    const id = parseInt(req.params.id);
    const { folderName, sortOrder } = req.body;

    const fav = await prisma.userFavorite.findFirst({ where: { id, userId } });
    if (!fav) return res.status(404).json({ error: '找不到最愛項目' });

    const updated = await prisma.userFavorite.update({
      where: { id },
      data: { folderName: folderName ?? fav.folderName, sortOrder: sortOrder ?? fav.sortOrder },
    });
    res.json(updated);
  } catch (err) {
    safeError(res, err);
  }
};
