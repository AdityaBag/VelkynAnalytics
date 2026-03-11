set -euo pipefail
PROJECT="/mnt/d/Quant Projects/Quant-Pricing-Engine"
BUILD_DIR="$PROJECT/.aws/lambda_build"
ZIP_PATH="$PROJECT/.aws/velkyn_lambda.zip"
rm -rf "$BUILD_DIR" "$ZIP_PATH"
mkdir -p "$BUILD_DIR"
python3 -m pip install -r "$PROJECT/requirements.txt" -t "$BUILD_DIR"
cp -r "$PROJECT/backend" "$BUILD_DIR/"
cp -r "$PROJECT/bs_engine" "$BUILD_DIR/"
cp -r "$PROJECT/binomial_engine" "$BUILD_DIR/"
cp -r "$PROJECT/mc_engine" "$BUILD_DIR/"
cp -r "$PROJECT/vol_engine" "$BUILD_DIR/"
cp -r "$PROJECT/data_engine" "$BUILD_DIR/"
if [ -f "$PROJECT/__init__.py" ]; then cp "$PROJECT/__init__.py" "$BUILD_DIR/"; fi
cd "$BUILD_DIR"
zip -rq "$ZIP_PATH" .
echo "ZIP_PATH=$ZIP_PATH"
ls -lh "$ZIP_PATH"