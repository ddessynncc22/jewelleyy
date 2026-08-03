const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse } = require('../utils/response');

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return successResponse(res, categories);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return errorResponse(res, 'Category name is required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create category', 400);
    const existing = await Category.findOne({ name: name.trim() });
    if (existing) {
      return errorResponse(res, 'Category already exists', 400);
    }
    const category = await Category.create({ name: name.trim(), tenantId: req.tenantId });
    await ActivityLog.create({
      action: 'create',
      module: 'category',
      description: `Category "${category.name}" created`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, category, 'Category created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }
    const { name } = req.body;
    if (name && name.trim()) {
      category.name = name.trim();
      await category.save();
    }
    await ActivityLog.create({
      action: 'update',
      module: 'category',
      description: `Category renamed to "${category.name}"`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, category, 'Category updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }
    await category.softDelete();
    await ActivityLog.create({
      action: 'delete',
      module: 'category',
      description: `Category "${category.name}" deleted`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, null, 'Category deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
