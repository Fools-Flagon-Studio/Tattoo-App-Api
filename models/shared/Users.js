const { DataTypes } = require("sequelize");
const db = require("./../../server");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const Users = db.define(
  "users",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    publicId: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: { msg: "Must be a valid email address." },
        notNull: { msg: "Email is required." },
      },
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: "Password is required." },
        len: {
          args: [8, 255],
          msg: "Password must be at least 8 characters long.",
        },
      },
    },
    passwordChangedAt: DataTypes.DATE,
    passwordResetToken: DataTypes.STRING,
    passwordResetExpires: DataTypes.DATE,
    role: {
      type: DataTypes.ENUM("artist", "client", "admin"),
      allowNull: false,
      validate: {
        notNull: { msg: "User role is required." },
        isIn: {
          args: [["artist", "client", "admin"]],
          msg: "Invalid user role. Must be 'artist', 'client', or 'admin'.",
        },
      },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    verifiedEmail: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    verifyToken: DataTypes.STRING,
    verifyExpires: DataTypes.DATE,
  },
  {
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["publicId"],
        name: "users_public_id_unique_idx",
      },
      { unique: true, fields: ["email"], name: "users_email_unique_idx" },
      { fields: ["role"], name: "users_role_idx" },
      { fields: ["isActive"], name: "users_is_active_idx" },
      { fields: ["verifiedEmail"], name: "users_verified_email_idx" },
      {
        fields: ["passwordResetToken"],
        name: "users_password_reset_token_idx",
      },
      { fields: ["verifyToken"], name: "users_verify_token_idx" },
    ],
    hooks: {
      beforeSave: async (user) => {
        if (user.changed("passwordHash")) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
          user.passwordChangedAt = new Date(Date.now() - 1000);
        }
      },
    },
  }
);

Users.prototype.correctPassword = async function (
  candidatePassword,
  storedPassword
) {
  return await bcrypt.compare(candidatePassword, storedPassword);
};

Users.prototype.changedPasswordAfter = function (JWTTimestamp) {
  if (!this.passwordChangedAt) return false;
  const changedTimestamp = parseInt(
    this.passwordChangedAt.getTime() / 1000,
    10
  );
  return JWTTimestamp < changedTimestamp;
};

Users.prototype.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

Users.prototype.createVerifyToken = async function () {
  const createVerifyToken = crypto.randomBytes(32).toString("hex");
  this.verifyToken = crypto
    .createHash("sha256")
    .update(createVerifyToken)
    .digest("hex");
  this.verifyExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  return createVerifyToken;
};

Users.prototype.verifyEmailToken = async function (submittedToken) {
  if (Date.now() > this.verifyExpires) {
    throw new Error("Token has expired");
  }
  const submittedTokenHash = crypto
    .createHash("sha256")
    .update(submittedToken)
    .digest("hex");
  if (submittedTokenHash === this.verifyToken) {
    return true;
  } else {
    throw new Error("InvalidToken");
  }
};

module.exports = Users;
