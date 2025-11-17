import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type Blog } from '@/lib/supabase'
import { STORE_ID } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar } from 'lucide-react'
import NotFound from './NotFound'

const BlogPost = () => {
  const [blog, setBlog] = useState<Blog | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (slug) {
      fetchBlog(slug)
    }
  }, [slug])

  const fetchBlog = async (blogSlug: string) => {
    try {
      const { data, error } = await supabase
        .from('content')
        .select('*')
        .eq('slug', blogSlug)
        .eq('status', 'published')
        .eq('store_id', STORE_ID)
        .single()

      if (error) {
        console.error('Error fetching blog:', error)
        setNotFound(true)
        return
      }
      
      setBlog(data)
    } catch (error) {
      console.error('Error fetching blog:', error)
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const renderContentWithImages = (content: string, images?: string[]) => {
    if (!images || images.length <= 1) {
      return <div dangerouslySetInnerHTML={{ __html: content }} />
    }

    // Si hay más de una imagen, insertamos las adicionales en el contenido
    const additionalImages = images.slice(1) // Excluir la primera imagen (ya mostrada como featured)
    const paragraphs = content.split('</p>')
    
    let result: JSX.Element[] = []
    
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.trim()) {
        result.push(
          <div key={`paragraph-${index}`} dangerouslySetInnerHTML={{ __html: paragraph + '</p>' }} />
        )
        
        // Insertar imagen después de ciertos párrafos
        const imageIndex = Math.floor((index + 1) * additionalImages.length / paragraphs.length)
        if (imageIndex < additionalImages.length && imageIndex > 0 && !result.find(el => el.key === `image-${imageIndex}`)) {
          result.push(
            <div key={`image-${imageIndex}`} className="my-8">
              <img 
                src={additionalImages[imageIndex - 1]}
                alt={`Article image ${imageIndex}`}
                className="w-full max-w-2xl mx-auto rounded-lg object-cover"
              />
            </div>
          )
        }
      }
    })

    return <>{result}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded-md mb-8"></div>
            <div className="h-64 bg-gray-200 rounded-md mb-8"></div>
            <div className="space-y-4">
              <div className="h-4 bg-gray-200 rounded-md"></div>
              <div className="h-4 bg-gray-200 rounded-md"></div>
              <div className="h-4 bg-gray-200 rounded-md w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !blog) {
    return <NotFound />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/blog')}
            className="text-black hover:text-gray-600 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to blog
          </Button>
        </div>
      </header>

      {/* Blog Post Content */}
      <main className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article>
            {/* Featured Image */}
            {blog.featured_image && blog.featured_image.length > 0 && (
              <div className="mb-8">
                <img 
                  src={blog.featured_image[0]} 
                  alt={blog.title}
                  className="w-full h-64 md:h-96 object-cover rounded-lg"
                />
              </div>
            )}

            {/* Article Header */}
            <header className="mb-8">
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Calendar className="h-4 w-4 mr-2" />
                {blog.created_at && formatDate(blog.created_at)}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-black mb-4">
                {blog.title}
              </h1>
              {blog.excerpt && (
                <p className="text-lg text-gray-600 leading-relaxed">
                  {blog.excerpt}
                </p>
              )}
            </header>

            {/* Article Content */}
            <div className="prose prose-lg max-w-none">
              {blog.content ? (
                <div className="text-gray-800 leading-relaxed">
                  {renderContentWithImages(blog.content, blog.featured_image)}
                </div>
              ) : (
                <p className="text-gray-600">No content available for this article.</p>
              )}
            </div>
          </article>
        </div>
      </main>
    </div>
  )
}

export default BlogPost