const crypto = require('crypto');

const generateBarcode = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `JWL${timestamp}${random}`;
};

const generateSKU = (category, metalType, purity) => {
  const cat = category.substring(0, 3).toUpperCase();
  const metalMap = { gold: 'GLD', silver: 'SLV', diamond: 'DMD', gemstone: 'GEM' };
  const metal = metalMap[metalType] || 'OTH';
  const pur = purity.toString().padStart(3, '0');
  const unique = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${cat}-${metal}-${pur}-${unique}`;
};

module.exports = { generateBarcode, generateSKU };
