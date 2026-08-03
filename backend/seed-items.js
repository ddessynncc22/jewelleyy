const mongoose = require('mongoose');
const config = require('./src/config');
const { generateSKU, generateBarcode } = require('./src/services/barcode');

const items = [
  {
    itemName: 'Gold Chain',
    category: 'Necklace',
    metalType: 'gold',
    purity: 916,
    karat: 22,
    grossWeight: 18.5,
    stoneWeight: 0,
    netMetalWeight: 18.5,
    colour: 'Yellow',
    costPrice: 85000,
    sellingPrice: 95000,
    makingCharge: 4500,
    wastagePercent: 3,
    description: '22K yellow gold chain necklace, handcrafted',
    status: 'In Stock',
    quantity: 1,
    tags: ['gold', 'chain', 'necklace'],
  },
  {
    itemName: 'Diamond Ring',
    category: 'Ring',
    metalType: 'gold',
    purity: 750,
    karat: 18,
    grossWeight: 6.2,
    stoneWeight: 1.5,
    netMetalWeight: 4.7,
    colour: 'White',
    stoneType: 'Diamond',
    carat: 0.75,
    cut: 'Round Brilliant',
    clarity: 'VS1',
    costPrice: 65000,
    sellingPrice: 78000,
    makingCharge: 5500,
    wastagePercent: 2,
    description: '18K white gold ring with 0.75ct diamond',
    status: 'In Stock',
    quantity: 1,
    tags: ['diamond', 'ring', 'gold'],
  },
  {
    itemName: 'Silver Bangles',
    category: 'Bangle',
    metalType: 'silver',
    purity: 999,
    karat: 0,
    grossWeight: 45.0,
    stoneWeight: 0,
    netMetalWeight: 45.0,
    colour: 'Silver',
    costPrice: 12000,
    sellingPrice: 15000,
    makingCharge: 2000,
    wastagePercent: 5,
    description: 'Pure silver bangles set of 2, traditional design',
    status: 'In Stock',
    quantity: 2,
    tags: ['silver', 'bangles', 'traditional'],
  },
  {
    itemName: 'Gold Earrings',
    category: 'Earring',
    metalType: 'gold',
    purity: 916,
    karat: 22,
    grossWeight: 8.0,
    stoneWeight: 0.8,
    netMetalWeight: 7.2,
    colour: 'Yellow',
    stoneType: 'Ruby',
    carat: 0.4,
    cut: 'Oval',
    clarity: '',
    costPrice: 35000,
    sellingPrice: 42000,
    makingCharge: 3000,
    wastagePercent: 2.5,
    description: '22K gold earrings with ruby stones, jhumka style',
    status: 'In Stock',
    quantity: 1,
    tags: ['earrings', 'ruby', 'gold'],
  },
  {
    itemName: 'Gold Bracelet',
    category: 'Bracelet',
    metalType: 'gold',
    purity: 750,
    karat: 18,
    grossWeight: 14.0,
    stoneWeight: 0,
    netMetalWeight: 14.0,
    colour: 'Rose',
    costPrice: 55000,
    sellingPrice: 65000,
    makingCharge: 4000,
    wastagePercent: 3,
    description: '18K rose gold bracelet with floral pattern',
    status: 'In Stock',
    quantity: 1,
    tags: ['bracelet', 'rose-gold', 'gold'],
  },
];

async function seed() {
  try {
    await mongoose.connect(config.mongodbUri);
    console.log('Connected to MongoDB');

    const Category = require('./src/models/Category');
    const Item = require('./src/models/Item');
    const StockMovement = require('./src/models/StockMovement');
    const User = require('./src/models/User');
    const Tenant = require('./src/models/Tenant');
    const { runWithTenant } = require('./src/middleware/tenantPlugin');

    // Items are tenant-scoped. Without an ambient tenant the plugin leaves
    // tenantId unset and the seeded rows are invisible to every shop user, so
    // resolve a tenant first and create everything inside its context.
    //   node seed-items.js [tenant-slug]
    const slugArg = process.argv[2];
    const tenant = slugArg
      ? await Tenant.findOne({ slug: slugArg })
      : await Tenant.findOne().sort({ tenantNumber: 1 });

    if (!tenant) {
      console.error(
        slugArg
          ? `No tenant with slug "${slugArg}". Create one first via POST /api/tenants/onboard.`
          : 'No tenants exist yet. Create one via POST /api/tenants/onboard before seeding items.'
      );
      process.exit(1);
    }

    const admin = await User.findOne({ role: 'admin', tenantId: tenant.tenantNumber });
    const performedBy = admin?._id || null;
    console.log(`Seeding into tenant "${tenant.name}" (slug: ${tenant.slug}, tenantId: ${tenant.tenantNumber})`);

    await runWithTenant(tenant.tenantNumber, admin, async () => {
    for (const itemData of items) {
      let cat = await Category.findOne({ name: itemData.category });
      if (!cat) {
        cat = await Category.create({ name: itemData.category, isActive: true });
        console.log(`  Created category: ${cat.name}`);
      }

      const existing = await Item.findOne({ itemName: itemData.itemName, isDeleted: false });
      if (existing) {
        console.log(`  Skipped (exists): ${itemData.itemName}`);
        continue;
      }

      const item = await Item.create({
        ...itemData,
        SKU: generateSKU(itemData.category, itemData.metalType, itemData.purity),
        barcode: generateBarcode(),
      });
      console.log(`  Created item: ${item.itemName} (SKU: ${item.SKU})`);

      await StockMovement.create({
        item: item._id,
        type: 'stockIn',
        category: 'Purchase',
        quantity: item.quantity || 1,
        reference: `Seed-${item.SKU}`,
        notes: 'Initial stock from seed',
        performedBy,
      });
    }
    });

    console.log('Done - 5 random items added');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

seed();
