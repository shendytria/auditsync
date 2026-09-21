package utils

import (
	"image"
	"mime/multipart"

	"github.com/disintegration/imaging"
)

func CompressImage(file multipart.File, outputPath string) error {

	img, _, err := image.Decode(file)
	if err != nil {
		return err
	}

	img = imaging.Resize(img, 1600, 0, imaging.Lanczos)

	err = imaging.Save(img, outputPath, imaging.JPEGQuality(75))
	if err != nil {
		return err
	}

	return nil
}
