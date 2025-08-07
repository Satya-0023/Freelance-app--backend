const mongoose = require('mongoose');

const gigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [5, 'Minimum price is $5'],
    max: [10000, 'Price cannot exceed $10,000']
  },
  deliveryTime: {
    type: Number,
    required: [true, 'Delivery time (in days) is required'],
    min: [1, 'Minimum delivery time is 1 day']
  },
  images: [{
    type: String,
    validate: {
      validator: function (v) {
        return /\.(jpg|jpeg|png|webp|gif)$/i.test(v);
      },
      message: props => `${props.value} is not a valid image URL`
    }
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0
  },
  numReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

gigSchema.index({ title: 'text', description: 'text', category: 'text' });
gigSchema.index({ tags: 1 });

module.exports = mongoose.model('Gig', gigSchema);
