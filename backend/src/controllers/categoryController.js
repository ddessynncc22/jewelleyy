const Category = require('../models/Category');
const ActivityLog = require('../models/ActivityLog');
const { successResponse, errorResponse } = require('../utils/response');

// Resolve and validate the parent category from a request body. Subcategories
// may only hang off a top-level category (one level deep).
const resolveParent = async (parentId, tenantId, context) => {
  if (!parentId) return null;
  const parent = await Category.findOne({ _id: parentId, tenantId });
  if (!parent) {
    throw { message: 'Parent category not found', status: 400 };
  }
  if (parent.parent) {
    throw { message: `${parent.name} is already a subcategory — subcategories can only be nested one level deep`, status: 400 };
  }
  if (context && String(parent._id) === String(context._id)) {
    throw { message: 'A category cannot be its own parent', status: 400 };
  }
  return parent;
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Category.find().populate('parent', 'name').sort({ name: 1 });
    return successResponse(res, categories);
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, parent } = req.body;
    if (!name || !name.trim()) {
      return errorResponse(res, 'Category name is required', 400);
    }
    if (!req.tenantId) return errorResponse(res, 'Tenant context required to create category', 400);
    const parentRef = await resolveParent(parent, req.tenantId);
    const existing = await Category.findOne({ name: name.trim(), parent: parentRef ? parentRef._id : null });
    if (existing) {
      return errorResponse(res, parentRef ? `Subcategory "${name.trim()}" already exists under ${parentRef.name}` : 'Category already exists', 400);
    }
    const category = await Category.create({ name: name.trim(), parent: parentRef ? parentRef._id : null, tenantId: req.tenantId });
    await ActivityLog.create({
      action: 'create',
      module: 'category',
      description: parentRef ? `Subcategory "${category.name}" created under ${parentRef.name}` : `Category "${category.name}" created`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, await Category.findById(category._id).populate('parent', 'name'), 'Category created successfully', 201);
  } catch (error) {
    return errorResponse(res, error.message, error.status || 500);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }
    const { name, parent } = req.body;
    let moved = false;
    if (parent !== undefined) {
      const newParent = await resolveParent(parent, req.tenantId, category);
      const newParentId = newParent ? newParent._id : null;
      if (String(category.parent || null) !== String(newParentId)) {
        // A category that already has children cannot be demoted into a subcategory.
        if (newParentId) {
          const childCount = await Category.countDocuments({ parent: category._id, tenantId: req.tenantId });
          if (childCount > 0) {
            return errorResponse(res, `"${category.name}" has subcategories and cannot be moved into another category`, 400);
          }
        }
        category.parent = newParentId;
        moved = true;
      }
    }
    if (name && name.trim()) {
      category.name = name.trim();
    }
    await category.save();
    await ActivityLog.create({
      action: 'update',
      module: 'category',
      description: `Category updated to "${category.name}"${moved ? ' (moved)' : ''}`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, await Category.findById(category._id).populate('parent', 'name'), 'Category updated successfully');
  } catch (error) {
    return errorResponse(res, error.message, error.status || 500);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return errorResponse(res, 'Category not found', 404);
    }
    // Cascade: deleting a top-level category removes its subcategories too.
    await Category.deleteMany({ parent: category._id });
    await ActivityLog.create({
      action: 'delete',
      module: 'category',
      description: `Category "${category.name}" and its subcategories deleted permanently`,
      performedBy: req.user._id,
      referenceId: category._id,
      referenceModel: 'Category',
    });
    return successResponse(res, null, 'Category deleted successfully');
  } catch (error) {
    return errorResponse(res, error.message, 500);
  }
};
