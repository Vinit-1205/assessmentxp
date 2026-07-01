const express = require('express');
const router = express.Router();
const shim = require('../db/postgresShim');

// Optional authentication middleware: resolve user if token is present, but do not block if absent
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const { data: { user } } = await shim.auth.getUser(token);
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.app_metadata?.role || 'user',
          institution_id: user.app_metadata?.institution_id || null,
          active_role: user.app_metadata?.active_role || 'user',
        };
      }
    }
  } catch (err) {
    console.warn('[optionalAuth] Token parsing failed:', err.message);
  }
  next();
}

const PUBLIC_TABLES = ['tenant_users', 'institutions', 'tenants'];

router.post('/db-query', optionalAuth, async (req, res) => {
  const {
    table,
    action,
    selectCols,
    where,
    orExpr,
    order,
    limit,
    data,
    isSingle,
    isMaybeSingle,
  } = req.body;

  if (!table) {
    return res.status(400).json({ error: 'Missing table parameter' });
  }

  // Security gate: non-logged-in users can only query specific public tables in read-only mode
  if (!req.user) {
    if (action !== 'select' || !PUBLIC_TABLES.includes(table)) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required for this query' });
    }
  }

  try {
    const qb = shim.from(table);

    if (action === 'select') {
      qb.select(selectCols || '*');
    } else if (action === 'insert') {
      qb.insert(data);
    } else if (action === 'update') {
      qb.update(data);
    } else if (action === 'delete') {
      qb.delete();
    }

    if (where && Array.isArray(where)) {
      for (const cond of where) {
        qb.eq(cond.col, cond.val);
      }
    }

    if (orExpr) {
      qb.or(orExpr);
    }

    if (order) {
      qb.order(order.col, { ascending: order.ascending });
    }

    if (limit !== undefined && limit !== null) {
      qb.limit(limit);
    }

    if (isSingle) {
      qb.single();
    } else if (isMaybeSingle) {
      qb.maybeSingle();
    }

    const result = await qb.execute();
    res.json(result);
  } catch (err) {
    res.status(500).json({ data: null, error: err.message });
  }
});

module.exports = router;
